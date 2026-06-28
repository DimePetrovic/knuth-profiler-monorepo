import { computed, inject, Injectable, signal } from '@angular/core';
import {
  ENTRY_NODE_ID,
  EXIT_NODE_ID,
  GHOST_IN_NODE_ID,
  GHOST_OUT_NODE_ID,
} from '../../core/graph/graph.constants';
import { GraphData, GraphLayoutName, ReconStep, VizStep } from '../../core/graph/graph.types';
import { ReconstructionStateService } from './reconstruction-state.service';
import { SimulationStateService } from './simulation-state.service';
import { ExamplesGraphStateService } from './visualization-state.service';
import { WorkflowReportService } from './workflow-report.service';
import {
  WorkflowInstrumentedEdgeRow,
  WorkflowNodeExecutionRow,
  WorkflowReportCodeArtifact,
  WorkflowReportMetrics,
  WorkflowReportSourceLine,
} from './workflow-report.models';
import { getWorkflowStepMetadata } from './workflow-step-metadata';
import { WorkflowProgressSnapshot, WorkflowStepPolicyService } from './workflow-step-policy.service';

@Injectable({ providedIn: 'root' })
export class ExamplesWorkflowFacade {
  private readonly visualization = inject(ExamplesGraphStateService);
  private readonly simulation = inject(SimulationStateService);
  private readonly reconstruction = inject(ReconstructionStateService);
  private readonly report = inject(WorkflowReportService);
  private readonly stepPolicy = inject(WorkflowStepPolicyService);
  private readonly visualizationContext = signal<'examples' | 'cfg'>('examples');
  private readonly reportSourceArtifact = signal<WorkflowReportCodeArtifact | null>(null);
  private readonly context = computed<'examples' | 'cfg'>(() => this.visualizationContext());

  readonly examples = this.visualization.examples;
  readonly selectedId = this.visualization.selectedId;
  readonly step = this.visualization.step;
  readonly layoutName = this.visualization.layout;
  readonly selectedData = computed<GraphData | null>(() => this.visualization.graphData());
  readonly hasGraph = computed(() => this.selectedData() !== null);
  readonly hasImportedGraph = computed(() => this.visualization.importedGraphData() !== null);

  readonly overlay = computed(() => {
    const baseOverlay = this.visualization.overlay();
    const simulationOverlay = this.simulation.simOverlay();

    return {
      ...baseOverlay,
      counters: this.reconstruction.mergedCounters(),
      currentNodeId: simulationOverlay.currentNodeId,
      currentEdgeId: simulationOverlay.currentEdgeId
    };
  });

  readonly runs = computed(() => this.simulation.config().runs);
  readonly speed = computed(() => this.simulation.config().speed ?? 1);
  readonly hasValidSimulationRuns = computed(() => Number.isFinite(this.runs()) && this.runs() > 0);
  readonly isSimulationInputLocked = this.simulation.isConfigLocked;
  readonly isRunning = this.simulation.isRunning;
  readonly isPaused = this.simulation.isPaused;
  readonly currentRun = this.simulation.currentRun;
  readonly hasSimulationData = computed(() => Object.keys(this.simulation.counters()).length > 0);
  readonly simulationStatusLabel = computed(() => this.stepPolicy.getSimulationStatusLabel({
    isRunning: this.isRunning(),
    isPaused: this.isPaused(),
    currentRun: this.currentRun(),
    configuredRuns: this.runs(),
    hasSimulationData: this.hasSimulationData(),
  }));

  readonly reconSteps = this.reconstruction.steps;
  readonly reconIdx = this.reconstruction.idx;
  readonly pendingTreeEdges = this.reconstruction.pendingTreeEdgeIds;
  readonly reconLastMessage = this.reconstruction.lastComputeMessage;
  readonly reconCurrentNodeLabel = computed(() => {
    const idx = this.reconIdx();
    const steps = this.reconSteps();
    if (idx < 0 || idx >= steps.length) {
      return null;
    }

    const nodeId = steps[idx].nodeId;
    const node = this.selectedData()?.nodes.find(n => n.id === nodeId);
    return node?.label || nodeId;
  });
  readonly stepDescription = computed(() => getWorkflowStepMetadata(this.step()).description);
  readonly reportMetrics = computed<WorkflowReportMetrics | null>(() => {
    const graph = this.selectedData();
    if (!graph) {
      return null;
    }
    return this.report.buildMetrics(
      graph,
      this.visualization.instrumentedEdgeIds(),
      this.reconstruction.mergedCounters(),
    );
  });
  readonly reportCodeArtifact = computed<WorkflowReportCodeArtifact | null>(() => {
    if (this.context() === 'cfg') {
      return this.reportSourceArtifact();
    }

    return this.report.getExampleSourceSnippet(this.selectedId());
  });
  readonly reportRunCount = computed(() => this.currentRun());
  readonly reportConfiguredRunCount = computed(() => this.runs());
  readonly reportRunProgressText = computed(() => `${this.reportRunCount()} / ${this.reportConfiguredRunCount()}`);
  readonly reportInstrumentedEdges = computed<WorkflowInstrumentedEdgeRow[]>(() => {
    const graph = this.selectedData();
    if (!graph) {
      return [];
    }
    return this.report.buildInstrumentedEdges(
      graph,
      this.reconstruction.mergedCounters(),
      this.visualization.instrumentedEdgeIds(),
    );
  });
  readonly reportNodeExecutions = computed<WorkflowNodeExecutionRow[]>(() => {
    const graph = this.selectedData();
    if (!graph) {
      return [];
    }
    return this.report.buildNodeExecutions(
      graph,
      this.reconstruction.mergedCounters(),
      this.reportConfiguredRunCount(),
    );
  });
  readonly reportSourceLines = computed<WorkflowReportSourceLine[]>(() => {
    const artifact = this.reportCodeArtifact();
    const graph = this.selectedData();
    if (!artifact || !graph) {
      return [];
    }

    return this.report.buildSourceLines(graph, artifact, this.visualization.instrumentedEdgeIds());
  });

  readonly canStartVisualization = computed(() => this.step() === 0);
  readonly canAdvance = computed(() => this.step() > 0 && this.step() < 6);
  readonly isSimulationStep = computed(() => this.step() === 4);
  readonly isReconstructionStep = computed(() => this.step() === 5);
  readonly isReportStep = computed(() => this.step() === 6);
  readonly canProceedFromCurrentStep = computed(() => this.stepPolicy.canProceed(this.progressSnapshot()));
  readonly nextBlockedReason = computed(() => this.stepPolicy.nextBlockedReason(this.progressSnapshot()));

  useExamplesContext(): void {
    this.visualizationContext.set('examples');
  }

  useCfgContext(): void {
    this.visualizationContext.set('cfg');
  }

  enterExamplesPage(): void {
    this.useExamplesContext();
    this.visualization.resetAllState(true);
    this.reportSourceArtifact.set(null);
    this.resetDerivedState();
  }

  enterCfgPage(): void {
    this.useCfgContext();
    this.visualization.resetAllState(false);
    this.reportSourceArtifact.set(null);
    this.resetDerivedState();
  }

  finishAndReset(): void {
    this.visualization.resetAllState(true);
    this.reportSourceArtifact.set(null);
    this.resetDerivedState();
  }

  pickExample(exampleId: string): void {
    this.visualization.pickExample(exampleId);
    this.resetDerivedState();
  }

  setLayout(layoutName: string): void {
    if (layoutName === 'dagre' || layoutName === 'elk') {
      this.visualization.layout.set(layoutName as GraphLayoutName);
    }
  }

  loadImportedGraph(graphData: GraphData): void {
    this.visualization.setImportedGraph(graphData);
    this.resetDerivedState();
  }

  clearImportedGraph(): void {
    this.visualization.clearImportedGraph();
    this.reportSourceArtifact.set(null);
    this.resetDerivedState();
  }

  setReportSourceArtifact(artifact: WorkflowReportCodeArtifact): void {
    this.reportSourceArtifact.set(artifact);
  }

  startStep(): void {
    this.visualization.start();
    this.resetDerivedState();
  }

  nextStep(): void {
    const before = this.step();
    this.visualization.next();
    this.handleStepTransition(before, this.step());
  }

  prevStep(): void {
    const before = this.step();
    this.visualization.prev();
    this.handleStepTransition(before, this.step());
  }

  resetSteps(): void {
    this.visualization.reset();
    this.resetDerivedState();
  }

  reconComputeNext(): ReconStep | null {
    if (Object.keys(this.simulation.counters()).length === 0) {
      const prevFastMode = this.simulation.config().fastMode ?? false;
      this.simulation.setFastMode(true);
      this.simulation.start();
      this.simulation.setFastMode(prevFastMode);
    }

    return this.reconstruction.computeNext();
  }

  reconPrev(): void {
    this.reconstruction.prev();
  }

  reconNext(): void {
    this.reconstruction.next();
  }

  reconReset(): void {
    this.reconstruction.reset();
  }

  setRuns(runs: number): void {
    this.simulation.setRuns(runs);
  }

  setSpeed(speed: number): void {
    this.simulation.setSpeed(speed);
  }

  simStart(): void {
    if (!this.hasValidSimulationRuns()) {
      return;
    }
    this.simulation.start();
  }

  simPause(): void {
    this.simulation.pause();
  }

  simResume(): void {
    this.simulation.resume();
  }

  simStop(): void {
    this.simulation.stop();
  }

  simReset(): void {
    this.simulation.reset();
  }

  private handleStepTransition(before: VizStep, after: VizStep): void {
    if (!this.stepPolicy.shouldPreserveSimulationState(before, after)) {
      this.simulation.reset();
    }

    if (this.stepPolicy.shouldResetReconstruction(before, after)) {
      this.reconstruction.reset();
    }
  }

  private resetDerivedState(): void {
    this.simulation.reset();
    this.reconstruction.reset();
  }

  private progressSnapshot(): WorkflowProgressSnapshot {
    return {
      step: this.step(),
      isCfgContext: this.context() === 'cfg',
      graphReady: this.context() === 'cfg' ? this.hasImportedGraph() : this.hasGraph(),
      hasSimulationData: this.hasSimulationData(),
      isRunning: this.isRunning(),
      currentRun: this.currentRun(),
      configuredRuns: this.runs(),
      pendingTreeEdges: this.pendingTreeEdges().length,
    };
  }
}
