import html
import re

from app.errors import CfgParsingError


def dot_to_cfg(dot_graph: str) -> dict:
    if not dot_graph.strip():
        raise CfgParsingError('CFG DOT payload is empty.')

    nodes: dict[str, dict] = {}
    edges: list[dict] = []

    node_pattern = re.compile(r'"(?P<id>[^"\\]*(?:\\.[^"\\]*)*)"\s*\[(?P<attrs>[^\]]*)\]')
    edge_pattern = re.compile(r'"(?P<from>[^"\\]*(?:\\.[^"\\]*)*)"\s*->\s*"(?P<to>[^"\\]*(?:\\.[^"\\]*)*)"(?:\s*\[(?P<attrs>[^\]]*)\])?')

    # Only scan lines that are node declarations (not edge lines containing '->')
    node_lines = '\n'.join(line for line in dot_graph.splitlines() if '->' not in line)
    for match in node_pattern.finditer(node_lines):
        node_id = match.group('id')
        attrs = match.group('attrs')
        label = parse_dot_label(attrs)
        nodes[node_id] = {
            'id': node_id,
            'kind': infer_node_kind(label),
            'label': label or node_id,
            'range': None,
        }

    for match in edge_pattern.finditer(dot_graph):
        attrs = match.group('attrs') or ''
        label = parse_dot_label(attrs)
        edges.append(
            {
                'from': match.group('from'),
                'to': match.group('to'),
                'kind': 'branch' if label else 'next',
                'label': label,
            }
        )

    node_list = list(nodes.values())
    if not node_list:
        raise CfgParsingError('CFG DOT payload did not contain any nodes.')
    if not edges:
        raise CfgParsingError('CFG DOT payload did not contain any edges.')

    entry_id = pick_entry_node(node_list)
    exit_id = pick_exit_node(node_list)

    return {
        'entryNodeId': entry_id,
        'exitNodeId': exit_id,
        'nodes': node_list,
        'edges': edges,
    }


def normalize_cfg(cfg: dict) -> dict:
    nodes = cfg.get('nodes', [])
    edges = cfg.get('edges', [])
    if not nodes:
        nodes = [{'id': 'n0', 'kind': 'entry', 'label': 'ENTRY', 'range': None}]
    node_ids = [node.get('id') for node in nodes if isinstance(node, dict) and node.get('id')]
    if not node_ids:
        node_ids = ['n0']
    entry = cfg.get('entryNodeId') or node_ids[0]
    exit_node = cfg.get('exitNodeId') or node_ids[-1]
    return {
        'entryNodeId': entry,
        'exitNodeId': exit_node,
        'nodes': nodes,
        'edges': edges,
    }


def infer_node_kind(label: str) -> str:
    lower = (label or '').lower()
    if lower.startswith('method,'):
        return 'entry'
    if lower.startswith('method_return'):
        return 'exit'
    if 'entry' in lower:
        return 'entry'
    if 'exit' in lower:
        return 'exit'
    if 'return' in lower:
        return 'return'
    if 'if' in lower or 'while' in lower or '?' in lower:
        return 'branch'
    if 'call' in lower:
        return 'call'
    return 'stmt'


def parse_dot_label(attrs: str) -> str:
    # DOT supports escaped quotes and Joern's HTML-like labels.
    match = re.search(r'label\s*=\s*"(?P<label>(?:[^"\\]|\\.)*)"', attrs)
    if match:
        return bytes(match.group('label'), 'utf-8').decode('unicode_escape')

    html_label = extract_html_like_label(attrs)
    if not html_label:
        return ''

    decoded = html.unescape(html_label)
    decoded = re.sub(r'<BR\s*/?>', ' ', decoded, flags=re.IGNORECASE)
    decoded = re.sub(r'<[^>]+>', ' ', decoded)
    return re.sub(r'\s+', ' ', decoded).strip()


def extract_html_like_label(attrs: str) -> str:
    anchor = re.search(r'label\s*=\s*<', attrs)
    if not anchor:
        return ''

    start = anchor.end() - 1
    depth = 0
    for idx in range(start, len(attrs)):
        ch = attrs[idx]
        if ch == '<':
            depth += 1
        elif ch == '>':
            depth -= 1
            if depth == 0:
                return attrs[start + 1:idx]

    return ''


def pick_entry_node(nodes: list[dict]) -> str:
    for node in nodes:
        if node.get('kind') == 'entry':
            return node['id']
    return nodes[0]['id']


def pick_exit_node(nodes: list[dict]) -> str:
    for node in reversed(nodes):
        if node.get('kind') == 'exit':
            return node['id']
    return nodes[-1]['id']
