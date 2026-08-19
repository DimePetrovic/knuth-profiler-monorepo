import {
  ENTRY_SENTINEL_ID,
  EXIT_SENTINEL_ID,
  GHOST_IN_NODE_ID,
  GHOST_OUT_NODE_ID
} from './graph.constants';
import { computeInstrumentedEdgeIds, computeMaxWeightSpanningTree } from './graph-analysis';
import { GraphData } from './graph.types';

describe('graph-analysis helpers', () => {
  it('computes a deterministic max-weight spanning tree and ignores zero-weight sentinels', () => {
    const graph: GraphData = {
      nodes: [
        { id: GHOST_IN_NODE_ID },
        { id: 'ENTRY' },
        { id: 'A' },
        { id: 'B' },
        { id: 'EXIT' },
        { id: GHOST_OUT_NODE_ID }
      ],
      edges: [
        { id: ENTRY_SENTINEL_ID, source: GHOST_IN_NODE_ID, target: 'ENTRY', weight: 0, kind: 'entry' },
        { id: 'e0', source: 'ENTRY', target: 'A', weight: 9 },
        { id: 'e1', source: 'ENTRY', target: 'B', weight: 9 },
        { id: 'e2', source: 'A', target: 'B', weight: 4 },
        { id: 'e3', source: 'B', target: 'EXIT', weight: 7 },
        { id: EXIT_SENTINEL_ID, source: 'EXIT', target: GHOST_OUT_NODE_ID, weight: 0, kind: 'exit' }
      ]
    };

    expect(computeMaxWeightSpanningTree(graph)).toEqual(['e0', 'e1', 'e3']);
  });

  it('returns non-tree measurable edges plus the entry sentinel, but never the exit sentinel', () => {
    const graph: GraphData = {
      nodes: [
        { id: GHOST_IN_NODE_ID },
        { id: 'ENTRY' },
        { id: 'A' },
        { id: 'B' },
        { id: 'EXIT' },
        { id: GHOST_OUT_NODE_ID }
      ],
      edges: [
        { id: ENTRY_SENTINEL_ID, source: GHOST_IN_NODE_ID, target: 'ENTRY', weight: 0, kind: 'entry' },
        { id: 'e0', source: 'ENTRY', target: 'A', weight: 10 },
        { id: 'e1', source: 'A', target: 'B', weight: 8 },
        { id: 'e2', source: 'B', target: 'EXIT', weight: 6 },
        { id: 'e3', source: 'A', target: 'EXIT', weight: 3 },
        { id: EXIT_SENTINEL_ID, source: 'EXIT', target: GHOST_OUT_NODE_ID, weight: 0, kind: 'exit' }
      ]
    };

    expect(computeInstrumentedEdgeIds(graph, ['e0', 'e1', 'e2'])).toEqual(['e3', ENTRY_SENTINEL_ID]);
  });

  it('still assigns a real zero-weight edge to S, not just sentinels (regression for weight>0 filter bug)', () => {
    // A-B-C-D path (weight 5 each) plus a redundant A-D edge of weight 0.
    // The redundant edge must end up in S = E \ T, not be silently dropped
    // because its weight happens to be 0.
    const graph: GraphData = {
      nodes: [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }],
      edges: [
        { id: 'e0', source: 'A', target: 'B', weight: 5 },
        { id: 'e1', source: 'B', target: 'C', weight: 5 },
        { id: 'e2', source: 'C', target: 'D', weight: 5 },
        { id: 'e3', source: 'A', target: 'D', weight: 0 }
      ]
    };

    const tree = computeMaxWeightSpanningTree(graph);
    expect(tree).toEqual(['e0', 'e1', 'e2']);
    expect(computeInstrumentedEdgeIds(graph, tree)).toEqual(['e3']);
  });
});