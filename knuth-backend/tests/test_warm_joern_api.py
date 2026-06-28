from fastapi.testclient import TestClient

from warm_joern.main import app
from warm_joern.main import extract_cfg_dot
from warm_joern.main import extract_mock_statements
from warm_joern.main import run_joern_script


def test_analyze_uses_inline_source_when_path_is_not_shared() -> None:
    client = TestClient(app)

    response = client.post(
        '/analyze',
        json={
            'jobId': 'job-inline',
            'language': 'python',
            'path': '/tmp/worker-only-path/main.py',
            'filename': 'main.py',
            'source': 'print(1)',
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body['cfgJson'] is not None
    assert body['cfgJson']['entryNodeId'] == 'n0'
    assert body['cfgJson']['exitNodeId'].startswith('n')


def test_extract_mock_statements_skips_structural_lines() -> None:
    statements = extract_mock_statements(
        '\n'.join(
            [
                '#include <stdio.h>',
                '',
                'int main() {',
                '    if (x > 0) {',
                '        printf("ok\\n");',
                '    }',
                '    else {',
                '        return 1;',
                '    }',
                '}',
            ]
        )
    )

    assert statements == ['if (x > 0)', 'printf("ok\\n");', 'return 1;']


def test_run_joern_script_uses_param_arguments(monkeypatch, tmp_path) -> None:
    class Proc:
        returncode = 0
        stderr = ''
        stdout = 'digraph CFG {}'

    captured = {}

    def fake_run(cmd, capture_output, text, timeout):
        captured['cmd'] = cmd
        return Proc()

    monkeypatch.setenv('JOERN_SCRIPT', '/app/warm_joern/scripts/export_cfg.sc')
    monkeypatch.setattr('warm_joern.main.subprocess.run', fake_run)

    source_path = tmp_path / 'main.c'
    source_path.write_text('int main(){return 0;}', encoding='utf-8')

    request = type('Req', (), {'language': 'c', 'filename': 'main.c'})()
    output = run_joern_script('/opt/joern/joern-cli/joern', request, source_path)

    assert output == 'digraph CFG {}'
    assert '--param' in captured['cmd']
    assert f'inputFile={source_path}' in captured['cmd']
    assert 'language=c' in captured['cmd']
    assert 'filename=main.c' in captured['cmd']


def test_extract_cfg_dot_from_markers() -> None:
    out = '\n'.join(
        [
            '[INFO] Some Joern log',
            '__CFG_DOT_START__',
            'digraph cfg {',
            '  "1" -> "2"',
            '}',
            '__CFG_DOT_END__',
            '[INFO] done',
        ]
    )

    dot = extract_cfg_dot(out)
    assert dot.startswith('digraph cfg {')
    assert '"1" -> "2"' in dot


def test_extract_cfg_dot_fallback_regex() -> None:
    out = '[INFO] preface\ndigraph G {\n  a -> b\n}\n[INFO] tail'
    dot = extract_cfg_dot(out)
    assert dot == 'digraph G {\n  a -> b\n}'