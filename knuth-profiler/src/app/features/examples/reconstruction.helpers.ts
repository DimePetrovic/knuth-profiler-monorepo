import {
  ENTRY_SENTINEL_ID,
  EXIT_SENTINEL_ID,
  isSentinelEdge
} from '../../core/graph/graph.constants';
import { Counters, GraphData, GraphEdge, ReconTerm } from '../../core/graph/graph.types';

export function buildKnownCounts(simCounters: Counters, reconCounters: Counters): Map<string, number> {
  const knownCounts = new Map<string, number>();

  for (const edgeId of Object.keys(simCounters)) {
    knownCounts.set(edgeId, simCounters[edgeId]);
  }

  for (const edgeId of Object.keys(reconCounters)) {
    knownCounts.set(edgeId, reconCounters[edgeId]);
  }

  if (knownCounts.has(ENTRY_SENTINEL_ID)) {
    knownCounts.set(EXIT_SENTINEL_ID, knownCounts.get(ENTRY_SENTINEL_ID)!);
  }

  return knownCounts;
}

export function ensureKnownZeroCounts(knownCounts: Map<string, number>, edgeIds: readonly string[]): Map<string, number> {
  for (const edgeId of edgeIds) {
    if (!knownCounts.has(edgeId)) {
      knownCounts.set(edgeId, 0);
    }
  }

  return knownCounts;
}

export function findSolvableNodeAndEdge(
  data: GraphData,
  pendingTreeEdgeIds: readonly string[],
  knownCounts: ReadonlyMap<string, number>
): { nodeId: string; edge: GraphEdge } | null {
  const unknownTreeEdgeIds = new Set(pendingTreeEdgeIds);
  if (unknownTreeEdgeIds.size === 0) {
    return null;
  }

  for (const node of data.nodes) {
    const incidentEdges = data.edges.filter(edge => edge.source === node.id || edge.target === node.id);
    const unknownTreeEdges = incidentEdges.filter(edge => unknownTreeEdgeIds.has(edge.id));

    if (unknownTreeEdges.length !== 1) {
      continue;
    }

    const otherEdges = incidentEdges.filter(edge => !unknownTreeEdgeIds.has(edge.id));
    const areOtherEdgesKnown = otherEdges.every(edge => isSentinelEdge(edge) || knownCounts.has(edge.id));

    if (areOtherEdgesKnown) {
      return { nodeId: node.id, edge: unknownTreeEdges[0] };
    }
  }

  return null;
}

export function solveBalanceAtNode(
  data: GraphData,
  nodeId: string,
  unknownEdge: GraphEdge,
  knownCounts: ReadonlyMap<string, number>
): { x: number; terms: ReconTerm[] } {
  const incomingKnown = data.edges
    .filter(edge => edge.target === nodeId)
    .map(edge => ({ edge, value: knownCounts.get(edge.id) }))
    .filter((entry): entry is { edge: GraphEdge; value: number } => entry.value != null);

  const outgoingKnown = data.edges
    .filter(edge => edge.source === nodeId)
    .map(edge => ({ edge, value: knownCounts.get(edge.id) }))
    .filter((entry): entry is { edge: GraphEdge; value: number } => entry.value != null);

  const sumIn = incomingKnown.reduce((sum, entry) => sum + entry.value, 0);
  const sumOut = outgoingKnown.reduce((sum, entry) => sum + entry.value, 0);
  const xIsIncoming = unknownEdge.target === nodeId;

  const terms: ReconTerm[] = [
    ...incomingKnown.map(({ edge, value }) => ({ edgeId: edge.id, sign: 1 as const, value, label: edge.label })),
    ...outgoingKnown.map(({ edge, value }) => ({ edgeId: edge.id, sign: -1 as const, value, label: edge.label }))
  ];

  return {
    x: xIsIncoming ? sumOut - sumIn : sumIn - sumOut,
    terms
  };
}

export function renderBalanceText(data: GraphData, nodeId: string, edge: GraphEdge, x: number): string {
  const side = edge.target === nodeId ? 'улаз' : 'излаз';
  const value = x >= 0 ? `${x}` : `−${Math.abs(x)}`;

  return `Σ(улази) = Σ(излази)
Рачунамо непознату MST грану ${edge.id} као део ${side}-а:
⇒ вредност непознате гране је ${value}.`;
}