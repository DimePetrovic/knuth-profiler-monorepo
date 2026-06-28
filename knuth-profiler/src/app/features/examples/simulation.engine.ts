/**
 * Pure simulation engine: stateless functions for running traversals.
 * All state mutations are handed to the calling service.
 */

import { GraphData, GraphEdge, Counters, SimulationConfig } from '../../core/graph/graph.types';
import {
  ENTRY_NODE_ID,
  ENTRY_SENTINEL_ID,
  EXIT_NODE_ID,
  EXIT_SENTINEL_ID,
  GHOST_OUT_NODE_ID
} from '../../core/graph/graph.constants';

/**
 * Single fast run: traverse from ENTRY to EXIT, counting instrumented edges.
 * Returns updated counters.
 */
export function simulateSingleRun(
  gd: GraphData,
  instrumentedIds: Set<string>,
  maxSteps: number,
  rng: () => number,
  initialCounters: Counters
): Counters {
  const counters = { ...initialCounters };

  // Count entry sentinel if instrumented
  const entryEdge = gd.edges.find(e => e.id === ENTRY_SENTINEL_ID);
  if (entryEdge && instrumentedIds.has(entryEdge.id)) {
    counters[entryEdge.id] = (counters[entryEdge.id] ?? 0) + 1;
  }

  let node = ENTRY_NODE_ID;
  let steps = 0;

  while (steps++ < maxSteps) {
    if (node === EXIT_NODE_ID) break;

    const outgoing = getOutgoingEdges(gd, node);
    if (outgoing.length === 0) break; // dead end

    const edge = pickRandomEdge(outgoing, rng);
    if (instrumentedIds.has(edge.id)) {
      counters[edge.id] = (counters[edge.id] ?? 0) + 1;
    }
    node = edge.target;
  }

  return counters;
}

/**
 * Run all simulations in fast mode (no animation).
 * Returns final counters after all runs.
 */
export function runFastSimulation(
  gd: GraphData,
  instrumentedIds: Set<string>,
  config: SimulationConfig,
  rng: () => number
): Counters {
  let counters: Counters = {};

  for (let r = 0; r < config.runs; r++) {
    counters = simulateSingleRun(gd, instrumentedIds, config.maxStepsPerRun, rng, counters);
  }

  return counters;
}

/**
 * State for animated traversal: encapsulates one step of animation.
 * Consumed by the service to drive UI updates via signals.
 */
export interface AnimatedTraversalState {
  currentRun: number;
  currentNodeId: string;
  currentEdgeId: string | null;
  counters: Counters;
  isFinished: boolean;
}

/**
 * Initialize animated traversal: set up first run with entry sentinel.
 */
export function initializeAnimatedTraversal(
  gd: GraphData,
  instrumentedIds: Set<string>
): AnimatedTraversalState {
  const entryEdge = gd.edges.find(e => e.id === ENTRY_SENTINEL_ID);
  const counters: Counters = {};

  if (entryEdge && instrumentedIds.has(entryEdge.id)) {
    counters[entryEdge.id] = 1;
  }

  return {
    currentRun: 0,
    currentNodeId: ENTRY_NODE_ID,
    currentEdgeId: ENTRY_SENTINEL_ID,
    counters,
    isFinished: false
  };
}

/**
 * Perform one animation tick: advance simulation by one edge.
 * Returns new traversal state.
 */
export function tickAnimatedTraversal(
  gd: GraphData,
  instrumentedIds: Set<string>,
  config: SimulationConfig,
  state: AnimatedTraversalState
): AnimatedTraversalState {
  let { currentRun, currentNodeId, currentEdgeId, counters, isFinished } = state;
  let nextCounters = counters;

  if (isFinished || currentRun >= config.runs) {
    return { ...state, isFinished: true };
  }

  if (!currentNodeId) {
    currentNodeId = ENTRY_NODE_ID;
  }

  // Handle exit node: traverse exit sentinel, mark ghost_out state
  if (currentNodeId === EXIT_NODE_ID) {
    // Important: examples also use kind='exit' for normal incoming edges into EXIT,
    // so we must take the sentinel edge that starts at EXIT (or matches sentinel id).
    const exitEdge = gd.edges.find(
      e => e.id === EXIT_SENTINEL_ID || (e.source === EXIT_NODE_ID && e.kind === 'exit')
    );
    if (exitEdge) {
      currentEdgeId = exitEdge.id;
      currentNodeId = exitEdge.target; // typically GHOST_OUT_NODE_ID
    }
    return { currentRun, currentNodeId, currentEdgeId, counters, isFinished };
  }

  // Handle ghost_out: start next run or finish
  if (currentNodeId === GHOST_OUT_NODE_ID) {
    currentRun += 1;
    if (currentRun >= config.runs) {
      return { currentRun, currentNodeId, currentEdgeId: null, counters: nextCounters, isFinished: true };
    }
    // Start next run
    currentNodeId = ENTRY_NODE_ID;
    const entryEdge = gd.edges.find(e => e.id === ENTRY_SENTINEL_ID);
    if (entryEdge && instrumentedIds.has(entryEdge.id)) {
      nextCounters = incrementCounter(nextCounters, entryEdge.id);
    }
    currentEdgeId = ENTRY_SENTINEL_ID;
    return { currentRun, currentNodeId, currentEdgeId, counters: nextCounters, isFinished };
  }

  // Normal case: pick next edge from current node
  const outgoing = getOutgoingEdges(gd, currentNodeId);
  if (outgoing.length === 0) {
    // Dead end: jump to exit
    currentNodeId = EXIT_NODE_ID;
    currentEdgeId = null;
    return { currentRun, currentNodeId, currentEdgeId, counters: nextCounters, isFinished };
  }

  const edge = pickRandomEdge(outgoing, Math.random);
  if (instrumentedIds.has(edge.id)) {
    nextCounters = incrementCounter(nextCounters, edge.id);
  }

  currentEdgeId = edge.id;
  currentNodeId = edge.target;

  return { currentRun, currentNodeId, currentEdgeId, counters: nextCounters, isFinished };
}

// --- Helpers -----------------------------------------------

/**
 * Get all outgoing edges from a node.
 */
export function getOutgoingEdges(gd: GraphData, nodeId: string): GraphEdge[] {
  return gd.edges.filter(e => e.source === nodeId);
}

/**
 * Pick a random edge with probability proportional to edge weight.
 * If all weights are 0 or absent, falls back to uniform distribution.
 */
export function pickRandomEdge(edges: GraphEdge[], rng: () => number): GraphEdge {
  const weights = edges.map(e => (typeof e.weight === 'number' ? e.weight : 0));
  const sum = weights.reduce((a, b) => a + b, 0);

  if (sum <= 0) {
    // No positive weights: uniform random selection
    const idx = Math.floor(rng() * edges.length);
    return edges[Math.min(idx, edges.length - 1)];
  }

  // Weighted selection: roulette wheel
  let r = rng() * sum;
  for (let i = 0; i < edges.length; i++) {
    if (r < weights[i]) return edges[i];
    r -= weights[i];
  }
  return edges[edges.length - 1];
}

function incrementCounter(counters: Counters, edgeId: string): Counters {
  return {
    ...counters,
    [edgeId]: (counters[edgeId] ?? 0) + 1
  };
}
