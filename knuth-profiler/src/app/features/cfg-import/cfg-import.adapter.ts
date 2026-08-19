import { GraphData, GraphEdge, GraphNode } from '../../core/graph/graph.types';
import {
  ENTRY_NODE_ID,
  ENTRY_SENTINEL_ID,
  EXIT_NODE_ID,
  EXIT_SENTINEL_ID,
  GHOST_IN_NODE_ID,
  GHOST_OUT_NODE_ID,
} from '../../core/graph/graph.constants';
import { CfgResultJson } from './cfg-import.types';
import { assignKnuthWeights } from '../../core/graph/knuth-weights';

export function mapCfgJsonToGraphData(payload: CfgResultJson): GraphData {
  const entryNodeId = resolveEndpointNodeId(payload, 'entry');
  const exitNodeId = resolveEndpointNodeId(payload, 'exit');
  const remap = createNodeRemap(entryNodeId, exitNodeId);

  const nodes: GraphNode[] = payload.graph.nodes.map(node => {
    const mappedId = remap(node.id);
    return {
      id: mappedId,
      label: mappedId === ENTRY_NODE_ID ? 'ENTRY' : mappedId === EXIT_NODE_ID ? 'EXIT' : trimImportedNodeLabel(node.label || node.id),
      kind: mapNodeKind(node.kind, mappedId),
      data: {
        originalId: node.id,
        range: node.range,
      },
    };
  });

  const edges: GraphEdge[] = payload.graph.edges.map((edge, index) => ({
    id: `e${index}`,
    source: remap(edge.from),
    target: remap(edge.to),
    label: edge.label || '',
    kind: 'normal',
    weight: 0,
  }));

  ensureEndpointNodes(nodes);
  ensureSentinelNodes(nodes);
  ensureSentinelEdges(edges);
  assignKnuthWeights(nodes, edges);

  return { nodes: dedupeNodes(nodes), edges };
}


function resolveEndpointNodeId(payload: CfgResultJson, endpoint: 'entry' | 'exit'): string {
  if (endpoint === 'entry') {
    const methodLike = payload.graph.nodes.find(n => /^METHOD\b/i.test(n.label || ''))?.id;
    if (methodLike) return methodLike;
  }

  if (endpoint === 'exit') {
    const methodReturnLike = payload.graph.nodes.find(n => /^METHOD_RETURN\b/i.test(n.label || ''))?.id;
    if (methodReturnLike) return methodReturnLike;
  }

  const byKind = payload.graph.nodes.find(n => n.kind === endpoint)?.id;
  if (byKind) return byKind;

  const token = endpoint.toUpperCase();
  const byLabel = payload.graph.nodes.find(n => (n.label || '').toUpperCase() === token)?.id;
  if (byLabel) return byLabel;

  const byLabelContains = payload.graph.nodes.find(n => new RegExp(`\\b${endpoint}\\b`, 'i').test(n.label || ''))?.id;
  if (byLabelContains) return byLabelContains;

  return endpoint === 'entry' ? payload.graph.entryNodeId : payload.graph.exitNodeId;
}

function createNodeRemap(entryNodeId: string, exitNodeId: string): (id: string) => string {
  return (id: string): string => {
    if (id === entryNodeId) return ENTRY_NODE_ID;
    if (id === exitNodeId) return EXIT_NODE_ID;
    if (id === ENTRY_NODE_ID || id === EXIT_NODE_ID) return `cfg_${id}`;
    return id;
  };
}

function ensureEndpointNodes(nodes: GraphNode[]): void {
  if (!nodes.some(n => n.id === ENTRY_NODE_ID)) {
    nodes.push({ id: ENTRY_NODE_ID, label: 'ENTRY', kind: 'entry' });
  }
  if (!nodes.some(n => n.id === EXIT_NODE_ID)) {
    nodes.push({ id: EXIT_NODE_ID, label: 'EXIT', kind: 'exit' });
  }
}

function ensureSentinelNodes(nodes: GraphNode[]): void {
  if (!nodes.some(n => n.id === GHOST_IN_NODE_ID)) {
    nodes.push({ id: GHOST_IN_NODE_ID, label: '', kind: 'normal', data: { ghost: true } });
  }
  if (!nodes.some(n => n.id === GHOST_OUT_NODE_ID)) {
    nodes.push({ id: GHOST_OUT_NODE_ID, label: '', kind: 'normal', data: { ghost: true } });
  }
}

function ensureSentinelEdges(edges: GraphEdge[]): void {
  if (!edges.some(e => e.id === ENTRY_SENTINEL_ID)) {
    edges.push({
      id: ENTRY_SENTINEL_ID,
      source: GHOST_IN_NODE_ID,
      target: ENTRY_NODE_ID,
      label: '',
      kind: 'entry',
      weight: 0,
    });
  }

  if (!edges.some(e => e.id === EXIT_SENTINEL_ID)) {
    edges.push({
      id: EXIT_SENTINEL_ID,
      source: EXIT_NODE_ID,
      target: GHOST_OUT_NODE_ID,
      label: '',
      kind: 'exit',
      weight: 0,
    });
  }
}

function dedupeNodes(nodes: GraphNode[]): GraphNode[] {
  const seen = new Set<string>();
  return nodes.filter(node => {
    if (seen.has(node.id)) {
      return false;
    }
    seen.add(node.id);
    return true;
  });
}

function mapNodeKind(kind: string, mappedId: string): GraphNode['kind'] {
  if (mappedId === ENTRY_NODE_ID) return 'entry';
  if (mappedId === EXIT_NODE_ID) return 'exit';
  if (kind === 'branch') return 'decision';
  return 'normal';
}

function trimImportedNodeLabel(label: string): string {
  const raw = (label || '').trim();
  if (!raw) return raw;

  const commaIdx = raw.indexOf(',');
  if (commaIdx >= 0 && commaIdx + 1 < raw.length) {
    return raw.slice(commaIdx + 1).trim();
  }

  return raw;
}

// Zadrzano zbog postojecih uvoza; sama dodela tezina zivi u core/graph.
export { assignKnuthWeights };
