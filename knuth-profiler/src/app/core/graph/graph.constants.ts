import { GraphEdge } from './graph.types';

export const ENTRY_NODE_ID = 'ENTRY';
export const EXIT_NODE_ID = 'EXIT';
export const GHOST_IN_NODE_ID = '__ghost_in__';
export const GHOST_OUT_NODE_ID = '__ghost_out__';

export const ENTRY_SENTINEL_ID = '__entry_sentinel__';
export const EXIT_SENTINEL_ID = '__exit_sentinel__';

export function isSentinelEdgeId(edgeId: string): boolean {
  return edgeId === ENTRY_SENTINEL_ID || edgeId === EXIT_SENTINEL_ID;
}

export function isSentinelEdge(edge: Pick<GraphEdge, 'id'>): boolean {
  return isSentinelEdgeId(edge.id);
}