import {
  ENTRY_SENTINEL_ID,
  EXIT_SENTINEL_ID,
  isSentinelEdgeId
} from './graph.constants';
import { GraphData } from './graph.types';

class DisjointSet {
  private readonly parent = new Map<string, string>();

  find(nodeId: string): string {
    if (!this.parent.has(nodeId)) {
      this.parent.set(nodeId, nodeId);
    }

    const parentId = this.parent.get(nodeId)!;
    if (parentId !== nodeId) {
      this.parent.set(nodeId, this.find(parentId));
    }

    return this.parent.get(nodeId)!;
  }

  union(leftId: string, rightId: string): boolean {
    const leftRoot = this.find(leftId);
    const rightRoot = this.find(rightId);

    if (leftRoot === rightRoot) {
      return false;
    }

    this.parent.set(leftRoot, rightRoot);
    return true;
  }
}

export function computeMaxWeightSpanningTree(data: GraphData): string[] {
  const nodeIds = data.nodes.map(node => node.id);
  const disjointSet = new DisjointSet();

  const weightedEdges = data.edges
    .map(edge => ({ edge, weight: typeof edge.weight === 'number' ? edge.weight : 0 }))
    .filter(({ weight }) => weight > 0)
    .sort((left, right) => {
      const weightDiff = right.weight - left.weight;
      if (weightDiff !== 0) {
        return weightDiff;
      }

      return left.edge.id.localeCompare(right.edge.id);
    });

  const selectedEdgeIds: string[] = [];

  for (const { edge } of weightedEdges) {
    if (disjointSet.union(edge.source, edge.target)) {
      selectedEdgeIds.push(edge.id);
    }

    if (selectedEdgeIds.length >= nodeIds.length - 1) {
      break;
    }
  }

  return selectedEdgeIds;
}

export function computeInstrumentedEdgeIds(data: GraphData, mstEdgeIds: readonly string[]): string[] {
  const mstEdgeIdSet = new Set(mstEdgeIds);

  const instrumented = data.edges
    .filter(edge => (typeof edge.weight === 'number' ? edge.weight : 0) > 0)
    .filter(edge => !mstEdgeIdSet.has(edge.id))
    .map(edge => edge.id);

  if (!instrumented.includes(ENTRY_SENTINEL_ID) && data.edges.some(edge => edge.id === ENTRY_SENTINEL_ID)) {
    instrumented.push(ENTRY_SENTINEL_ID);
  }

  return instrumented.filter(edgeId => !isSentinelEdgeId(edgeId) || edgeId === ENTRY_SENTINEL_ID)
    .filter(edgeId => edgeId !== EXIT_SENTINEL_ID);
}