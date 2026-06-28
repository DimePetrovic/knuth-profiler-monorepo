import { Injectable, computed, signal } from '@angular/core';
import { Counters, GraphData, SimulationConfig } from '../../core/graph/graph.types';
import { ExamplesGraphStateService } from './visualization-state.service';
import {
  runFastSimulation,
  initializeAnimatedTraversal,
  tickAnimatedTraversal,
  AnimatedTraversalState
} from './simulation.engine';

@Injectable({ providedIn: 'root' })
export class SimulationStateService {
  // Config & runtime
  readonly config = signal<SimulationConfig>({ runs: 20, maxStepsPerRun: 200, speed: 3, fastMode: false });
  readonly isRunning = signal(false);
  readonly isPaused = signal(false);
  readonly isConfigLocked = signal(false);
  readonly currentRun = signal(0);
  readonly currentNodeId = signal<string | null>(null);
  readonly currentEdgeId = signal<string | null>(null);
  readonly counters = signal<Counters>({}); // instrumented only

  // Internal
  private timer: any = null;
  private rng: () => number = Math.random;

  // Derived from visualization state
  private get gd(): GraphData | null { return this.viz.graphData(); }
  private get instrumented(): Set<string> { return new Set(this.viz.instrumentedEdgeIds()); }

  // Public overlay for canvas
  readonly simOverlay = computed(() => ({
    counters: this.counters(),
    currentNodeId: this.currentNodeId(),
    currentEdgeId: this.currentEdgeId()
  }));

  constructor(private viz: ExamplesGraphStateService) {}

  setRuns(n: number) {
    if (this.isConfigLocked()) {
      return;
    }

    const normalizedRuns = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
    this.config.update(c => ({ ...c, runs: normalizedRuns }));
  }
  setSpeed(mult: number) {
    const normalizedSpeed = Number.isFinite(mult)
      ? Math.min(3, Math.max(0.25, mult))
      : 3;
    this.config.update(c => ({ ...c, speed: normalizedSpeed }));
  }
  setFastMode(on: boolean) {
    this.config.update(c => ({ ...c, fastMode: on }));
  }

  reset() {
    this.stopTimer();
    this.clearRuntimeState(true);
  }

  start() {
    if (!this.gd) return;

    this.stopTimer();
    this.clearRuntimeState(false);

    const cfg = this.config();
    if (!this.hasValidRunConfiguration(cfg)) {
      return;
    }

    this.isConfigLocked.set(true);
    this.rng = Math.random;
    this.isRunning.set(true);
    if (cfg.fastMode) {
      this.runFast();
    } else {
      this.runAnimated();
    }
  }

  pause() {
    if (!this.isRunning()) return;
    this.isPaused.set(true);
    this.stopTimer();
  }

  resume() {
    if (!this.isRunning()) return;
    if (!this.isPaused()) return;
    this.isPaused.set(false);
    this.tickLoop(); // resume timer
  }

  stop() {
    this.stopTimer();
    this.isRunning.set(false);
    this.isPaused.set(false);
    this.currentNodeId.set(null);
    this.currentEdgeId.set(null);
  }

  // --- Core simulation (using pure engine) --------------------------------

  private runFast() {
    const gd = this.gd;
    if (!gd) return;

    const cfg = this.config();
    const counters = runFastSimulation(gd, this.instrumented, cfg, this.rng);

    this.counters.set(counters);
    this.currentRun.set(cfg.runs);
    this.isRunning.set(false);
  }

  private runAnimated() {
    const gd = this.gd;
    if (!gd) return;

    const state = initializeAnimatedTraversal(gd, this.instrumented);
    this.applyTraversalState(state);
    this.tickLoop();
  }

  private tick() {
    if (!this.shouldTick()) return;

    const gd = this.gd;
    if (!gd) return;

    const nextState = tickAnimatedTraversal(
      gd,
      this.instrumented,
      this.config(),
      this.buildTraversalState(),
    );

    this.applyTraversalState(nextState);

    if (nextState.isFinished) {
      this.stop();
    }
  }

  private applyTraversalState(state: AnimatedTraversalState) {
    this.currentRun.set(state.currentRun);
    this.currentNodeId.set(state.currentNodeId);
    this.currentEdgeId.set(state.currentEdgeId);
    this.counters.set(state.counters);
  }

  // --- Helpers ----------------------------------------------------------

  private stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private tickLoop() {
    this.stopTimer();
    this.timer = setInterval(() => this.tick(), this.getTickIntervalMs());
  }

  private clearRuntimeState(unlockConfig: boolean): void {
    this.isRunning.set(false);
    this.isPaused.set(false);
    if (unlockConfig) {
      this.isConfigLocked.set(false);
    }
    this.currentRun.set(0);
    this.currentNodeId.set(null);
    this.currentEdgeId.set(null);
    this.counters.set({});
  }

  private hasValidRunConfiguration(config: SimulationConfig): boolean {
    return Number.isFinite(config.runs) && config.runs > 0;
  }

  private shouldTick(): boolean {
    return this.isRunning() && !this.isPaused();
  }

  private buildTraversalState(): AnimatedTraversalState {
    return {
      currentRun: this.currentRun(),
      currentNodeId: this.currentNodeId() || '',
      currentEdgeId: this.currentEdgeId(),
      counters: this.counters(),
      isFinished: false,
    };
  }

  private getTickIntervalMs(): number {
    const baseInterval = 500;
    return Math.round(baseInterval / (this.config().speed || 1));
  }
}
