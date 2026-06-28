/**
 * Pure simulation engine: stateless functions for running traversals.
 * All state mutations are handed to the calling service.
 */

import {
  simulateSingleRun,
  runFastSimulation,
  initializeAnimatedTraversal,
  tickAnimatedTraversal,
  getOutgoingEdges,
  pickRandomEdge
} from './simulation.engine';
import { GraphData, GraphEdge } from '../../core/graph/graph.types';
import {
  ENTRY_NODE_ID,
  ENTRY_SENTINEL_ID,
  EXIT_NODE_ID,
  GHOST_OUT_NODE_ID
} from '../../core/graph/graph.constants';

describe('SimulationEngine', () => {
  // Create simple test graph: ENTRY -> A -> EXIT + exit sentinel
  const createTestGraph = (): GraphData => ({
    nodes: [
      { id: ENTRY_NODE_ID, kind: 'entry' },
      { id: 'A', kind: 'normal' },
      { id: EXIT_NODE_ID, kind: 'exit' },
      { id: GHOST_OUT_NODE_ID, kind: 'ghost_out' }
    ],
    edges: [
      { id: ENTRY_SENTINEL_ID, source: ENTRY_NODE_ID, target: ENTRY_NODE_ID, kind: 'entry', weight: 1 },
      { id: 'e1', source: ENTRY_NODE_ID, target: 'A', kind: 'normal', weight: 1 },
      { id: 'e2', source: 'A', target: EXIT_NODE_ID, kind: 'normal', weight: 1 },
      { id: '__exit_sentinel__', source: EXIT_NODE_ID, target: GHOST_OUT_NODE_ID, kind: 'exit', weight: 1 }
    ]
  });

  // Deterministic RNG for testing
  const deterministicRng = (value: number) => () => value;

  describe('getOutgoingEdges', () => {
    it('should return edges from a node', () => {
      const gd = createTestGraph();
      const outgoing = getOutgoingEdges(gd, ENTRY_NODE_ID);
      expect(outgoing.length).toBe(2); // entry sentinel + e1
      expect(outgoing.map(e => e.id)).toContain(ENTRY_SENTINEL_ID);
      expect(outgoing.map(e => e.id)).toContain('e1');
    });

    it('should return empty array for node with no outgoing', () => {
      const gd = createTestGraph();
      const outgoing = getOutgoingEdges(gd, GHOST_OUT_NODE_ID);
      expect(outgoing.length).toBe(0);
    });
  });

  describe('pickRandomEdge', () => {
    it('should pick based on rng position', () => {
      const edges: GraphEdge[] = [
        { id: 'a', source: 'x', target: 'y', kind: 'normal' },
        { id: 'b', source: 'x', target: 'z', kind: 'normal' }
      ];
      const rng = deterministicRng(0.25);
      const picked = pickRandomEdge(edges, rng);
      expect(picked.id).toBe('a');
    });

    it('should pick weighted when weights present', () => {
      const edges: GraphEdge[] = [
        { id: 'a', source: 'x', target: 'y', kind: 'normal', weight: 1 },
        { id: 'b', source: 'x', target: 'z', kind: 'normal', weight: 3 }
      ];
      // Sum = 4, so roulette: [0, 1) -> a, [1, 4) -> b
      const rng = deterministicRng(0.1); // 0.1 * 4 = 0.4 -> a
      expect(pickRandomEdge(edges, rng).id).toBe('a');
    });
  });

  describe('simulateSingleRun', () => {
    it('should count entry sentinel if instrumented', () => {
      const gd = createTestGraph();
      const instrumented = new Set([ENTRY_SENTINEL_ID]);
      // RNG picks index 1 (e1) from [sentinel, e1]
      const rng = deterministicRng(0.6);
      const counters = simulateSingleRun(gd, instrumented, 100, rng, {});

      expect(counters[ENTRY_SENTINEL_ID]).toBe(1);
      expect(counters['e1']).toBeUndefined(); // not instrumented
    });

    it('should count traversed e1 but not e2', () => {
      const gd = createTestGraph();
      const instrumented = new Set(['e1']);
      // RNG picks index 1 (e1) from [sentinel, e1], then e2
      const rng = deterministicRng(0.6);
      const counters = simulateSingleRun(gd, instrumented, 100, rng, {});

      expect(counters[ENTRY_SENTINEL_ID]).toBeUndefined();
      expect(counters['e1']).toBe(1);
      expect(counters['e2']).toBeUndefined();
    });

    it('should accumulate into existing counters', () => {
      const gd = createTestGraph();
      const instrumented = new Set(['e1']);
      const rng = deterministicRng(0.6);
      const initial = { 'e1': 5 };
      const counters = simulateSingleRun(gd, instrumented, 100, rng, initial);

      expect(counters['e1']).toBe(6); // 5 + 1
    });
  });

  describe('runFastSimulation', () => {
    it('should run all runs and return final counters', () => {
      const gd = createTestGraph();
      const instrumented = new Set([ENTRY_SENTINEL_ID]);
      const config = { runs: 2, maxStepsPerRun: 100, speed: 1, fastMode: true };
      const counters = runFastSimulation(gd, instrumented, config, deterministicRng(0.6));

      // 2 runs x 1 entry sentinel per run
      expect(counters[ENTRY_SENTINEL_ID]).toBe(2);
    });
  });

  describe('initializeAnimatedTraversal', () => {
    it('should initialize with ENTRY node and entry sentinel', () => {
      const gd = createTestGraph();
      const instrumented = new Set([ENTRY_SENTINEL_ID]);
      const state = initializeAnimatedTraversal(gd, instrumented);

      expect(state.currentRun).toBe(0);
      expect(state.currentNodeId).toBe(ENTRY_NODE_ID);
      expect(state.currentEdgeId).toBe(ENTRY_SENTINEL_ID);
      expect(state.counters[ENTRY_SENTINEL_ID]).toBe(1);
      expect(state.isFinished).toBe(false);
    });
  });

  describe('tickAnimatedTraversal', () => {
    it('should return a new counters object when incrementing entry sentinel on next run', () => {
      const gd = createTestGraph();
      const instrumented = new Set([ENTRY_SENTINEL_ID]);
      const config = { runs: 3, maxStepsPerRun: 100, speed: 1, fastMode: false };

      const stateAtGhostOut = {
        currentRun: 0,
        currentNodeId: GHOST_OUT_NODE_ID,
        currentEdgeId: '__exit_sentinel__',
        counters: { [ENTRY_SENTINEL_ID]: 1 },
        isFinished: false
      };

      const next = tickAnimatedTraversal(gd, instrumented, config, stateAtGhostOut);
      expect(next.counters[ENTRY_SENTINEL_ID]).toBe(2);
      expect(next.counters).not.toBe(stateAtGhostOut.counters);
    });

    it('should traverse the outgoing exit sentinel when at EXIT (regression)', () => {
      const gd = createTestGraph();
      const instrumented = new Set<string>();
      const config = { runs: 2, maxStepsPerRun: 100, speed: 1, fastMode: false };

      // Add an incoming edge to EXIT that is also marked kind='exit' to mirror real examples.
      gd.edges.unshift({ id: 'incoming-exit-kind', source: 'A', target: EXIT_NODE_ID, kind: 'exit', weight: 1 });

      const stateAtExit = {
        currentRun: 0,
        currentNodeId: EXIT_NODE_ID,
        currentEdgeId: 'incoming-exit-kind',
        counters: {},
        isFinished: false
      };

      const next = tickAnimatedTraversal(gd, instrumented, config, stateAtExit);
      expect(next.currentNodeId).toBe(GHOST_OUT_NODE_ID);
      expect(next.currentEdgeId).toBe('__exit_sentinel__');
      expect(next.isFinished).toBe(false);
    });

    it('should mark finished after all runs done', () => {
      const gd = createTestGraph();
      const instrumented = new Set<string>();
      const config = { runs: 1, maxStepsPerRun: 100, speed: 1, fastMode: false };

      let state = initializeAnimatedTraversal(gd, instrumented);
      for (let i = 0; i < 20; i++) {
        state = tickAnimatedTraversal(gd, instrumented, config, state);
        if (state.isFinished) break;
      }

      expect(state.isFinished).toBe(true);
    });
  });
});
