import {
  ENTRY_SENTINEL_ID,
  EXIT_SENTINEL_ID,
  GHOST_IN_NODE_ID,
  GHOST_OUT_NODE_ID
} from '../../core/graph/graph.constants';
import { GraphData } from '../../core/graph/graph.types';
import {
  buildKnownCounts,
  ensureKnownZeroCounts,
  findSolvableNodeAndEdge,
  renderBalanceText,
  solveBalanceAtNode
} from './reconstruction.helpers';

describe('reconstruction helpers', () => {
  const graph: GraphData = {
    nodes: [
      { id: GHOST_IN_NODE_ID },
      { id: 'ENTRY', kind: 'entry' },
      { id: 'A' },
      { id: 'EXIT', kind: 'exit' },
      { id: GHOST_OUT_NODE_ID }
    ],
    edges: [
      { id: ENTRY_SENTINEL_ID, source: GHOST_IN_NODE_ID, target: 'ENTRY', kind: 'entry', weight: 0 },
      { id: 'e0', source: 'ENTRY', target: 'A', weight: 10 },
      { id: 'e1', source: 'A', target: 'EXIT', weight: 5 },
      { id: EXIT_SENTINEL_ID, source: 'EXIT', target: GHOST_OUT_NODE_ID, kind: 'exit', weight: 0 }
    ]
  };

  it('mirrors the entry sentinel count into the virtual exit sentinel count', () => {
    const knownCounts = buildKnownCounts({ [ENTRY_SENTINEL_ID]: 7, e1: 7 }, { e0: 7 });

    expect(knownCounts.get(ENTRY_SENTINEL_ID)).toBe(7);
    expect(knownCounts.get(EXIT_SENTINEL_ID)).toBe(7);
    expect(knownCounts.get('e0')).toBe(7);
  });

  it('fills missing instrumented counters with zero', () => {
    const knownCounts = buildKnownCounts({ [ENTRY_SENTINEL_ID]: 3 }, {});
    ensureKnownZeroCounts(knownCounts, ['e0', 'e1']);

    expect(knownCounts.get('e0')).toBe(0);
    expect(knownCounts.get('e1')).toBe(0);
    expect(knownCounts.get(ENTRY_SENTINEL_ID)).toBe(3);
  });

  it('finds a solvable node when exactly one tree edge is still unknown', () => {
    const knownCounts = buildKnownCounts({ [ENTRY_SENTINEL_ID]: 4, e1: 4 }, {});

    expect(findSolvableNodeAndEdge(graph, ['e0'], knownCounts)).toEqual({
      nodeId: 'ENTRY',
      edge: graph.edges[1]
    });
  });

  it('solves node balance and emits readable terms', () => {
    const knownCounts = buildKnownCounts({ [ENTRY_SENTINEL_ID]: 4, e1: 4 }, {});
    const result = solveBalanceAtNode(graph, 'ENTRY', graph.edges[1], knownCounts);

    expect(result.x).toBe(4);
    expect(result.terms).toEqual([
      { edgeId: ENTRY_SENTINEL_ID, sign: 1, value: 4, label: undefined }
    ]);
  });

  it('renders the explanation text with node, edge and resolved value', () => {
    expect(renderBalanceText(graph, 'ENTRY', graph.edges[1], 4)).toContain('вредност непознате гране је 4');
    expect(renderBalanceText(graph, 'ENTRY', graph.edges[1], 4)).toContain('e0');
  });
});