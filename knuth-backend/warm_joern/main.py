import json
import os
import re
import subprocess
import tempfile
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title='Warm Joern Wrapper', version='1.0.0')


class AnalyzeRequest(BaseModel):
    jobId: str
    language: str
    path: str
    filename: str
    source: str


class AnalyzeResponse(BaseModel):
    cfgJson: dict | None = None
    cfgDot: str | None = None


@app.get('/health')
def health() -> dict:
    return {'status': 'ok'}


@app.post('/analyze', response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    source_path, cleanup_path = resolve_source_path(request)

    try:
        joern_bin = os.getenv('JOERN_BIN')
        if joern_bin:
            try:
                dot = run_joern_script(joern_bin, request, source_path)
            except (RuntimeError, subprocess.TimeoutExpired) as exc:
                raise HTTPException(status_code=502, detail=str(exc)) from exc
            return AnalyzeResponse(cfgDot=dot)

        # Fallback mock mode for local development without Joern binary.
        cfg_json = mock_cfg_from_source(source_path.read_text(encoding='utf-8'))
        return AnalyzeResponse(cfgJson=cfg_json)
    finally:
        if cleanup_path is not None:
            cleanup_path.unlink(missing_ok=True)


def resolve_source_path(request: AnalyzeRequest) -> tuple[Path, Path | None]:
    source_path = Path(request.path)
    if source_path.exists():
        return source_path, None
    if request.source:
        suffix = Path(request.filename).suffix or '.txt'
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, mode='w', encoding='utf-8') as handle:
            handle.write(request.source)
            return Path(handle.name), Path(handle.name)
    raise HTTPException(status_code=400, detail='Source path does not exist and no source content was provided.')


def run_joern_script(joern_bin: str, request: AnalyzeRequest, source_path: Path) -> str:
    # This wrapper expects a Joern script path via env var.
    script = os.getenv('JOERN_SCRIPT')
    if not script:
        raise RuntimeError('JOERN_SCRIPT env var is required when JOERN_BIN is set.')

    cmd = [
        joern_bin,
        '--script',
        script,
        '--param',
        f'inputFile={source_path}',
        '--param',
        f'language={request.language}',
        '--param',
        f'filename={request.filename}',
    ]

    timeout_seconds = int(os.getenv('HARD_TIMEOUT_SECONDS', '120'))
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_seconds)
    if proc.returncode != 0:
        raise RuntimeError(f'Joern failed: {proc.stderr[-1000:]}')

    output = proc.stdout.strip()
    if not output:
        raise RuntimeError('Joern returned empty output.')

    dot = extract_cfg_dot(output)
    if not dot:
        tail = output[-1200:]
        raise RuntimeError(f'Joern output did not contain CFG DOT. Output tail: {tail}')
    return dot


def extract_cfg_dot(output: str) -> str:
    start_marker = '__CFG_DOT_START__'
    end_marker = '__CFG_DOT_END__'

    start = output.find(start_marker)
    end = output.find(end_marker)
    if start != -1 and end != -1 and end > start:
        body = output[start + len(start_marker):end].strip()
        if body:
            return body

    match = re.search(r'(digraph\s+[A-Za-z0-9_]*\s*\{[\s\S]*\})', output)
    if match:
        return match.group(1).strip()

    return ''


def mock_cfg_from_source(source: str) -> dict:
    lines = extract_mock_statements(source)
    nodes = [{'id': 'n0', 'kind': 'entry', 'label': 'ENTRY', 'range': None}]
    edges = []

    for i, line in enumerate(lines, start=1):
        node_id = f'n{i}'
        kind = infer_kind(line)
        label = line[:80]
        nodes.append({'id': node_id, 'kind': kind, 'label': label, 'range': None})
        edges.append({'from': f'n{i-1}', 'to': node_id, 'kind': 'next', 'label': ''})

    exit_id = f'n{len(lines)+1}'
    nodes.append({'id': exit_id, 'kind': 'exit', 'label': 'EXIT', 'range': None})
    edges.append({'from': f'n{len(lines)}' if lines else 'n0', 'to': exit_id, 'kind': 'next', 'label': ''})

    return {
        'entryNodeId': 'n0',
        'exitNodeId': exit_id,
        'nodes': nodes,
        'edges': edges,
    }


def extract_mock_statements(source: str) -> list[str]:
    statements: list[str] = []

    for raw_line in source.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith('#'):
            continue
        if line.startswith('//'):
            continue
        if line in {'{', '}', '};'}:
            continue
        if is_function_declaration(line):
            continue
        if line.endswith('{'):
            line = line[:-1].rstrip()
        if line in {'else', 'do'}:
            continue
        if not line:
            continue
        statements.append(line)

    return statements


def is_function_declaration(line: str) -> bool:
    return bool(re.match(r'^[A-Za-z_][\w\s\*]*\s+[A-Za-z_]\w*\s*\([^;]*\)\s*\{$', line))


def infer_kind(line: str) -> str:
    lower = line.lower()
    if re.search(r'\b(if|while|for|switch|case)\b', lower):
        return 'branch'
    if re.search(r'\breturn\b', lower):
        return 'return'
    if re.search(r'\w+\s*\(', line):
        return 'call'
    return 'stmt'
