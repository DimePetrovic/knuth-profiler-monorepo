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
  assignBallLarusWeights(nodes, edges);

  return { nodes: dedupeNodes(nodes), edges };
}

function assignBallLarusWeights(nodes: GraphNode[], edges: GraphEdge[]): void {
  const normalEdges = edges.filter(edge => edge.kind === 'normal');
  if (normalEdges.length === 0) {
    return;
  }

  const nodeIds = new Set(nodes.map(node => node.id));
  const outgoing = new Map<string, GraphEdge[]>();
  for (const nodeId of nodeIds) {
    outgoing.set(nodeId, []);
  }

  for (const edge of normalEdges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      continue;
    }
    outgoing.get(edge.source)?.push(edge);
  }

  for (const group of outgoing.values()) {
    group.sort((left, right) => left.id.localeCompare(right.id));
  }

  const backEdgeIds = detectBackEdgeIds(nodeIds, outgoing);
  const acyclicOutgoing = new Map<string, GraphEdge[]>();
  for (const [nodeId, group] of outgoing.entries()) {
    acyclicOutgoing.set(nodeId, group.filter(edge => !backEdgeIds.has(edge.id)));
  }

  const topoOrder = buildTopologicalOrder(nodeIds, acyclicOutgoing);
  const reachableToExit = findNodesThatReachExit(acyclicOutgoing);
  const pathCountByNode = computePathCounts(topoOrder, acyclicOutgoing, reachableToExit);

  for (const edge of normalEdges) {
    edge.weight = 1;
  }

  for (const nodeId of topoOrder) {
    const outgoingEdges = outgoing.get(nodeId) ?? [];
    if (outgoingEdges.length === 0) {
      continue;
    }

    let offset = 1;
    for (const edge of outgoingEdges) {
      if (backEdgeIds.has(edge.id)) {
        edge.weight = 1;
        continue;
      }

      edge.weight = offset;
      const targetPathCount = pathCountByNode.get(edge.target) ?? 1;
      offset += Math.max(1, targetPathCount);
    }
  }
}

function detectBackEdgeIds(
  nodeIds: Set<string>,
  outgoing: Map<string, GraphEdge[]>
): Set<string> {
  const backEdgeIds = new Set<string>();
  const visitState = new Map<string, 0 | 1 | 2>();
  const sortedNodeIds = Array.from(nodeIds).sort((left, right) => left.localeCompare(right));

  const dfs = (nodeId: string): void => {
    visitState.set(nodeId, 1);

    for (const edge of outgoing.get(nodeId) ?? []) {
      const state = visitState.get(edge.target) ?? 0;
      if (state === 0) {
        dfs(edge.target);
      } else if (state === 1) {
        backEdgeIds.add(edge.id);
      }
    }

    visitState.set(nodeId, 2);
  };

  for (const nodeId of sortedNodeIds) {
    if ((visitState.get(nodeId) ?? 0) === 0) {
      dfs(nodeId);
    }
  }

  return backEdgeIds;
}

function buildTopologicalOrder(
  nodeIds: Set<string>,
  outgoing: Map<string, GraphEdge[]>
): string[] {
  const visited = new Set<string>();
  const order: string[] = [];
  const sortedNodeIds = Array.from(nodeIds).sort((left, right) => left.localeCompare(right));

  const visit = (nodeId: string): void => {
    if (visited.has(nodeId)) {
      return;
    }

    visited.add(nodeId);
    for (const edge of outgoing.get(nodeId) ?? []) {
      visit(edge.target);
    }
    order.push(nodeId);
  };

  for (const nodeId of sortedNodeIds) {
    visit(nodeId);
  }

  return order.reverse();
}

function findNodesThatReachExit(outgoing: Map<string, GraphEdge[]>): Set<string> {
  const incoming = new Map<string, string[]>();

  for (const [nodeId, edges] of outgoing.entries()) {
    if (!incoming.has(nodeId)) {
      incoming.set(nodeId, []);
    }

    for (const edge of edges) {
      if (!incoming.has(edge.target)) {
        incoming.set(edge.target, []);
      }
      incoming.get(edge.target)?.push(edge.source);
    }
  }

  const reachable = new Set<string>([EXIT_NODE_ID]);
  const stack = [EXIT_NODE_ID];

  while (stack.length > 0) {
    const nodeId = stack.pop()!;
    for (const predecessor of incoming.get(nodeId) ?? []) {
      if (reachable.has(predecessor)) {
        continue;
      }
      reachable.add(predecessor);
      stack.push(predecessor);
    }
  }

  return reachable;
}

function computePathCounts(
  topoOrder: string[],
  outgoing: Map<string, GraphEdge[]>,
  reachableToExit: Set<string>
): Map<string, number> {
  const pathCountByNode = new Map<string, number>();

  for (let index = topoOrder.length - 1; index >= 0; index -= 1) {
    const nodeId = topoOrder[index];

    if (nodeId === EXIT_NODE_ID) {
      pathCountByNode.set(nodeId, 1);
      continue;
    }

    const validOutgoing = (outgoing.get(nodeId) ?? [])
      .filter(edge => reachableToExit.has(edge.target));

    if (validOutgoing.length === 0) {
      pathCountByNode.set(nodeId, 1);
      continue;
    }

    const sum = validOutgoing
      .reduce((acc, edge) => acc + (pathCountByNode.get(edge.target) ?? 1), 0);
    pathCountByNode.set(nodeId, Math.max(1, sum));
  }

  return pathCountByNode;
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
