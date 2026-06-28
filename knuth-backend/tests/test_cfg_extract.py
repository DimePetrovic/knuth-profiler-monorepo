from pathlib import Path

from app.services.cfg_extract import dot_to_cfg, normalize_cfg


def test_dot_to_cfg_parses_nodes_and_edges() -> None:
    dot = Path('tests/fixtures/sample_joern_cfg.dot').read_text(encoding='utf-8')
    cfg = dot_to_cfg(dot)

    assert cfg['entryNodeId'] == 'n0'
    assert cfg['exitNodeId'] == 'n3'
    assert len(cfg['nodes']) == 4
    assert len(cfg['edges']) == 4

    kinds = {n['id']: n['kind'] for n in cfg['nodes']}
    assert kinds['n0'] == 'entry'
    assert kinds['n1'] == 'branch'
    assert kinds['n3'] == 'exit'


def test_normalize_cfg_ensures_entry_and_exit() -> None:
    cfg = normalize_cfg({'nodes': [{'id': 'x', 'kind': 'stmt', 'label': 'x', 'range': None}], 'edges': []})
    assert cfg['entryNodeId'] == 'x'
    assert cfg['exitNodeId'] == 'x'


def test_dot_to_cfg_parses_joern_html_labels() -> None:
    dot = '''
digraph "main" {
node [shape="rect"];
"30064771072" [label = <&lt;operator&gt;.assignment, 3<BR/>x = 1> ]
"141733920768" [label = <RETURN, 5<BR/>return x;> ]
"30064771073" [label = <&lt;operator&gt;.greaterThan, 4<BR/>x &gt; 0> ]
"107374182400" [label = <METHOD, 2<BR/>main> ]
"124554051584" [label = <METHOD_RETURN, 2<BR/>int> ]
  "30064771072" -> "30064771073"
  "141733920768" -> "124554051584"
  "30064771073" -> "141733920768"
  "107374182400" -> "30064771072"
}
'''

    cfg = dot_to_cfg(dot)

    assert cfg['entryNodeId'] == '107374182400'
    assert cfg['exitNodeId'] == '124554051584'
    kinds = {n['id']: n['kind'] for n in cfg['nodes']}
    assert kinds['107374182400'] == 'entry'
    assert kinds['124554051584'] == 'exit'
    assert len(cfg['edges']) == 4
