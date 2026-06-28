import { Injectable, computed, signal } from '@angular/core';
import { isSentinelEdge } from '../../core/graph/graph.constants';
import { Counters, GraphData, ReconStep } from '../../core/graph/graph.types';
import { ExamplesGraphStateService } from './visualization-state.service';
import { SimulationStateService } from './simulation-state.service';
import {
  buildKnownCounts,
  ensureKnownZeroCounts,
  findSolvableNodeAndEdge,
  renderBalanceText,
  solveBalanceAtNode
} from './reconstruction.helpers';

@Injectable({ providedIn: 'root' })
export class ReconstructionStateService {
  // Reconstructed counts for MST edges (edgeId -> count)
  readonly reconCounters = signal<Counters>({});
  // Ordered explanation steps user can browse
  readonly steps = signal<ReconStep[]>([]);
  // Pointer in the steps list
  readonly idx = signal<number>(-1);
  readonly lastComputeMessage = signal<string | null>(null);

  // Data providers
  private get gd(): GraphData | null { return this.viz.graphData(); }
  private get mstIds(): Set<string> { return new Set(this.viz.mstEdgeIds()); }

  // Known (instrumented) counters from simulation
  private get simCounters(): Counters { return this.sim.counters(); }

  // Merge known + reconstructed -> overlay counters for the canvas
  readonly mergedCounters = computed<Counters>(() => {
    const merged: Counters = { ...this.simCounters };
    const r = this.reconCounters();
    for (const k of Object.keys(r)) merged[k] = r[k];
    return merged;
  });

  /**
   * Pending = ALL MST edges (excluding sentinels by id) minus already reconstructed.
   * This is the correct definition of "Preostalo za rešavanje".
   */
  readonly pendingTreeEdgeIds = computed<string[]>(() => {
    const gd = this.gd; if (!gd) return [];
    const setTree = this.mstIds;
    const solved = new Set(Object.keys(this.reconCounters()));

    return gd.edges
      .filter(e => setTree.has(e.id))
      .filter(e => !isSentinelEdge(e)) // exclude only __entry_sentinel__/__exit_sentinel__
      .map(e => e.id)
      .filter(id => !solved.has(id));
  });

  constructor(
    private viz: ExamplesGraphStateService,
    private sim: SimulationStateService
  ) {}

  reset() {
    this.reconCounters.set({});
    this.steps.set([]);
    this.idx.set(-1);
    this.lastComputeMessage.set(null);
  }

  /**
   * Compute exactly one next MST edge using node-flow balance.
   * Rule: pick a node where there is EXACTLY ONE unknown MST incident edge
   * AND all other incident edges (MST or not) are known, or are sentinels (sentinels don't block).
   */
  computeNext(): ReconStep | null {
    const gd = this.gd;
    if (!gd) {
      this.lastComputeMessage.set('Graf nije učitan.');
      return null;
    }

    const pending = this.pendingTreeEdgeIds();
    if (pending.length === 0) {
      this.lastComputeMessage.set('Nema preostalih MST grana za rekonstrukciju.');
      return null;
    }

    const known = this.allKnownCounts();

    const candidate = findSolvableNodeAndEdge(gd, pending, known);
    if (!candidate) {
      this.lastComputeMessage.set(
        `Nijedan čvor trenutno nije rešiv. Pending MST grane: ${pending.length}, poznatih brojača: ${known.size}. Pokreni simulaciju ili idi na sledeći korak.`
      );
      return null;
    }

    const { nodeId, edge } = candidate;

    // Solve x via balance at `nodeId`
    const { x, terms } = solveBalanceAtNode(gd, nodeId, edge, this.allKnownCounts());

    // Persist result
    const rec = { ...this.reconCounters() };
    rec[edge.id] = x;
    this.reconCounters.set(rec);

    const step: ReconStep = {
      solvedEdgeId: edge.id,
      value: x,
      nodeId,
      parentId: (edge.source === nodeId ? edge.target : edge.source),
      equation: terms,
      text: renderBalanceText(gd, nodeId, edge, x)
    };

    const arr = [...this.steps(), step];
    this.steps.set(arr);
    this.idx.set(arr.length - 1);
    this.lastComputeMessage.set(null);

    return step;
  }

  // Optional step browsing
  prev(): ReconStep | null {
    const i = this.idx(); if (i <= 0) return null;
    this.idx.set(i - 1);
    return this.steps()[this.idx()];
  }
  next(): ReconStep | null {
    const i = this.idx(); if (i + 1 >= this.steps().length) return null;
    this.idx.set(i + 1);
    return this.steps()[this.idx()];
  }
  /**
   * Known counts = simulation counters (instrumented + entry sentinel) + already reconstructed
   * + VIRTUAL exit sentinel set equal to entry sentinel (conservation of runs).
   * Exit sentinel is not displayed; it's only used internally for balance at EXIT node.
   */
  private allKnownCounts(): Map<string, number> {
    const knownCounts = buildKnownCounts(this.simCounters, this.reconCounters());
    return ensureKnownZeroCounts(knownCounts, this.viz.instrumentedEdgeIds());
  }
}
