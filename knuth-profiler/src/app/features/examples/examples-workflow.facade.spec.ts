import { TestBed } from '@angular/core/testing';
import { ExamplesWorkflowFacade } from './examples-workflow.facade';
import { ReconstructionStateService } from './reconstruction-state.service';
import { SimulationStateService } from './simulation-state.service';
import { ExamplesGraphStateService } from './visualization-state.service';
import { GraphData } from '../../core/graph/graph.types';

const IMPORTED_GRAPH_FIXTURE: GraphData = {
  nodes: [
    { id: 'ENTRY', label: 'ENTRY', kind: 'entry' },
    { id: 'A', label: 'A', kind: 'normal' },
    { id: 'EXIT', label: 'EXIT', kind: 'exit' }
  ],
  edges: [
    { id: 'e0', source: 'ENTRY', target: 'A', kind: 'normal', weight: 1 },
    { id: 'e1', source: 'A', target: 'EXIT', kind: 'normal', weight: 1 }
  ]
};

describe('ExamplesWorkflowFacade', () => {
  let facade: ExamplesWorkflowFacade;
  let visualization: ExamplesGraphStateService;
  let simulation: SimulationStateService;
  let reconstruction: ReconstructionStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    facade = TestBed.inject(ExamplesWorkflowFacade);
    visualization = TestBed.inject(ExamplesGraphStateService);
    simulation = TestBed.inject(SimulationStateService);
    reconstruction = TestBed.inject(ReconstructionStateService);
  });

  it('preserves simulation counters when moving from measurement to reconstruction', () => {
    visualization.step.set(4);
    simulation.counters.set({ e2: 3 });
    reconstruction.reconCounters.set({ e0: 1 });

    facade.nextStep();

    expect(visualization.step()).toBe(5);
    expect(simulation.counters()).toEqual({ e2: 3 });
    expect(reconstruction.reconCounters()).toEqual({ e0: 1 });
  });

  it('resets both simulation and reconstruction when advancing before measurement', () => {
    visualization.step.set(2);
    simulation.counters.set({ e2: 3 });
    reconstruction.reconCounters.set({ e0: 1 });

    facade.nextStep();

    expect(visualization.step()).toBe(3);
    expect(simulation.counters()).toEqual({});
    expect(reconstruction.reconCounters()).toEqual({});
  });

  it('resets reconstruction but keeps simulation counters when leaving reconstruction', () => {
    visualization.step.set(5);
    simulation.counters.set({ e2: 3 });
    reconstruction.reconCounters.set({ e0: 1 });

    facade.prevStep();

    expect(visualization.step()).toBe(4);
    expect(simulation.counters()).toEqual({ e2: 3 });
    expect(reconstruction.reconCounters()).toEqual({});
  });

  it('preserves simulation and reconstruction when moving from reconstruction to report', () => {
    visualization.step.set(5);
    simulation.counters.set({ e2: 10 });
    reconstruction.reconCounters.set({ e0: 4 });

    facade.nextStep();

    expect(visualization.step()).toBe(6);
    expect(simulation.counters()).toEqual({ e2: 10 });
    expect(reconstruction.reconCounters()).toEqual({ e0: 4 });
  });

  it('requires imported CFG graph in cfg context before first step can proceed', () => {
    facade.enterCfgPage();
    visualization.selectedId.set(visualization.examples[0].id);

    expect(facade.step()).toBe(0);
    expect(facade.canProceedFromCurrentStep()).toBeFalse();

    facade.loadImportedGraph(IMPORTED_GRAPH_FIXTURE);
    expect(facade.canProceedFromCurrentStep()).toBeTrue();
  });

  it('enterExamplesPage hard-resets runtime state and requires fresh selection', () => {
    facade.loadImportedGraph(IMPORTED_GRAPH_FIXTURE);
    visualization.step.set(4);
    simulation.counters.set({ e2: 9 });
    reconstruction.reconCounters.set({ e0: 5 });

    facade.enterExamplesPage();

    expect(facade.step()).toBe(0);
    expect(visualization.importedGraphData()).toBeNull();
    expect(facade.selectedId()).toBe('');
    expect(simulation.counters()).toEqual({});
    expect(reconstruction.reconCounters()).toEqual({});
    expect(facade.canProceedFromCurrentStep()).toBeFalse();
  });

  it('finishAndReset clears both graph sources and runtime state', () => {
    facade.loadImportedGraph(IMPORTED_GRAPH_FIXTURE);
    facade.pickExample(visualization.examples[0].id);
    visualization.step.set(6);
    simulation.counters.set({ e9: 1 });
    reconstruction.reconCounters.set({ e0: 7 });

    facade.finishAndReset();

    expect(facade.step()).toBe(0);
    expect(visualization.importedGraphData()).toBeNull();
    expect(facade.selectedId()).toBe('');
    expect(simulation.counters()).toEqual({});
    expect(reconstruction.reconCounters()).toEqual({});
  });
});

describe('ExamplesWorkflowFacade – computed signals and step guards', () => {
  let facade: ExamplesWorkflowFacade;
  let visualization: ExamplesGraphStateService;
  let simulation: SimulationStateService;
  let reconstruction: ReconstructionStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    facade = TestBed.inject(ExamplesWorkflowFacade);
    visualization = TestBed.inject(ExamplesGraphStateService);
    simulation = TestBed.inject(SimulationStateService);
    reconstruction = TestBed.inject(ReconstructionStateService);
    facade.enterExamplesPage();
  });

  describe('simulationStatusLabel', () => {
    it('returns Ради when running and not paused', () => {
      simulation.isRunning.set(true);
      simulation.isPaused.set(false);
      expect(facade.simulationStatusLabel()).toBe('Ради');
    });

    it('returns Пауза when running and paused', () => {
      simulation.isRunning.set(true);
      simulation.isPaused.set(true);
      expect(facade.simulationStatusLabel()).toBe('Пауза');
    });

    it('returns Завршено when stopped with full run count and data', () => {
      simulation.isRunning.set(false);
      simulation.config.update(c => ({ ...c, runs: 10 }));
      simulation.currentRun.set(10);
      simulation.counters.set({ e1: 5 });
      expect(facade.simulationStatusLabel()).toBe('Завршено');
    });

    it('returns Стојеће when idle with no data', () => {
      expect(facade.simulationStatusLabel()).toBe('Стојеће');
    });
  });

  describe('step identity computed signals', () => {
    it('isSimulationStep is true only at step 4', () => {
      visualization.step.set(4);
      expect(facade.isSimulationStep()).toBeTrue();
      visualization.step.set(3);
      expect(facade.isSimulationStep()).toBeFalse();
    });

    it('isReconstructionStep is true only at step 5', () => {
      visualization.step.set(5);
      expect(facade.isReconstructionStep()).toBeTrue();
      visualization.step.set(6);
      expect(facade.isReconstructionStep()).toBeFalse();
    });

    it('isReportStep is true only at step 6', () => {
      visualization.step.set(6);
      expect(facade.isReportStep()).toBeTrue();
      visualization.step.set(5);
      expect(facade.isReportStep()).toBeFalse();
    });
  });

  describe('hasValidSimulationRuns', () => {
    it('is true with positive run count', () => {
      simulation.config.update(c => ({ ...c, runs: 5 }));
      expect(facade.hasValidSimulationRuns()).toBeTrue();
    });

    it('is false when run count is 0', () => {
      simulation.config.update(c => ({ ...c, runs: 0 }));
      expect(facade.hasValidSimulationRuns()).toBeFalse();
    });
  });

  describe('canProceedFromCurrentStep', () => {
    it('returns true at step 1 when example is selected', () => {
      facade.pickExample(visualization.examples[0].id);
      visualization.step.set(1);
      expect(facade.canProceedFromCurrentStep()).toBeTrue();
    });

    it('returns false at step 4 while simulation is running', () => {
      facade.pickExample(visualization.examples[0].id);
      visualization.step.set(4);
      simulation.isRunning.set(true);
      simulation.counters.set({ e1: 1 });
      expect(facade.canProceedFromCurrentStep()).toBeFalse();
    });

    it('returns false at step 4 when run count not yet complete', () => {
      facade.pickExample(visualization.examples[0].id);
      visualization.step.set(4);
      simulation.isRunning.set(false);
      simulation.config.update(c => ({ ...c, runs: 20 }));
      simulation.currentRun.set(5);
      simulation.counters.set({ e1: 1 });
      expect(facade.canProceedFromCurrentStep()).toBeFalse();
    });

    it('returns false at step 4 when no simulation data collected', () => {
      facade.pickExample(visualization.examples[0].id);
      visualization.step.set(4);
      simulation.isRunning.set(false);
      simulation.config.update(c => ({ ...c, runs: 10 }));
      simulation.currentRun.set(10);
      expect(facade.canProceedFromCurrentStep()).toBeFalse();
    });

    it('returns true at step 4 when simulation completed with data', () => {
      facade.pickExample(visualization.examples[0].id);
      visualization.step.set(4);
      simulation.isRunning.set(false);
      simulation.config.update(c => ({ ...c, runs: 10 }));
      simulation.currentRun.set(10);
      simulation.counters.set({ e1: 5 });
      expect(facade.canProceedFromCurrentStep()).toBeTrue();
    });
  });

  describe('nextBlockedReason', () => {
    it('returns a message when at step 0 in examples context with no selection', () => {
      visualization.selectedId.set('');
      expect(facade.nextBlockedReason()).toBeTruthy();
    });

    it('returns null when path is clear at step 1', () => {
      facade.pickExample(visualization.examples[0].id);
      visualization.step.set(1);
      expect(facade.nextBlockedReason()).toBeNull();
    });

    it('returns running message at step 4 while simulation is active', () => {
      visualization.step.set(4);
      simulation.isRunning.set(true);
      expect(facade.nextBlockedReason()).toBeTruthy();
    });

    it('returns runs-incomplete message at step 4 when runs not finished', () => {
      visualization.step.set(4);
      simulation.isRunning.set(false);
      simulation.config.update(c => ({ ...c, runs: 10 }));
      simulation.currentRun.set(3);
      simulation.counters.set({ e1: 1 });
      expect(facade.nextBlockedReason()).toBeTruthy();
    });

    it('returns no-data message at step 4 when simulation not run', () => {
      visualization.step.set(4);
      expect(facade.nextBlockedReason()).toBeTruthy();
    });

    it('returns message at step 0 in cfg context when no imported graph', () => {
      facade.enterCfgPage();
      expect(facade.nextBlockedReason()).toBeTruthy();
    });
  });

  describe('stepDescription', () => {
    it('returns a non-empty string for every step 0 through 6', () => {
      for (let s = 0; s <= 6; s++) {
        visualization.step.set(s as any);
        expect(facade.stepDescription().length).toBeGreaterThan(0);
      }
    });
  });

  describe('reportCodeArtifact', () => {
    it('returns source snippet for known example id in examples context', () => {
      visualization.selectedId.set('if-else');
      expect(facade.reportCodeArtifact()?.filename).toBe('if-else.c');
    });

    it('returns null for unknown example id in examples context', () => {
      visualization.selectedId.set('not-a-real-example-id');
      expect(facade.reportCodeArtifact()).toBeNull();
    });

    it('returns null in cfg context before any artifact is set', () => {
      facade.enterCfgPage();
      expect(facade.reportCodeArtifact()).toBeNull();
    });

    it('returns the set artifact in cfg context', () => {
      facade.enterCfgPage();
      facade.setReportSourceArtifact({ filename: 'hello.c', language: 'c', source: 'int x;' });
      expect(facade.reportCodeArtifact()?.filename).toBe('hello.c');
    });

    it('clears cfg artifact on enterCfgPage', () => {
      facade.enterCfgPage();
      facade.setReportSourceArtifact({ filename: 'a.c', language: 'c', source: 'x' });
      facade.enterCfgPage();
      expect(facade.reportCodeArtifact()).toBeNull();
    });
  });

  describe('setLayout', () => {
    it('accepts valid dagre layout', () => {
      facade.setLayout('dagre');
      expect(facade.layoutName()).toBe('dagre');
    });

    it('accepts valid elk layout', () => {
      facade.setLayout('elk');
      expect(facade.layoutName()).toBe('elk');
    });

    it('ignores unknown layout values without changing state', () => {
      facade.setLayout('dagre');
      facade.setLayout('d3-force');
      expect(facade.layoutName()).toBe('dagre');
    });
  });

  describe('simulation delegate methods', () => {
    it('simStop clears running and paused state', () => {
      simulation.isRunning.set(true);
      simulation.isPaused.set(true);
      facade.simStop();
      expect(facade.isRunning()).toBeFalse();
      expect(facade.isPaused()).toBeFalse();
    });

    it('simPause sets paused when running', () => {
      simulation.isRunning.set(true);
      facade.simPause();
      expect(facade.isPaused()).toBeTrue();
    });

    it('simResume clears paused when running and paused', () => {
      simulation.isRunning.set(true);
      simulation.isPaused.set(true);
      facade.simResume();
      expect(facade.isPaused()).toBeFalse();
    });

    it('simReset clears all simulation counters and locks', () => {
      simulation.isRunning.set(true);
      simulation.counters.set({ e1: 5 });
      simulation.isConfigLocked.set(true);
      facade.simReset();
      expect(facade.isRunning()).toBeFalse();
      expect(facade.hasSimulationData()).toBeFalse();
      expect(facade.isSimulationInputLocked()).toBeFalse();
    });
  });
});