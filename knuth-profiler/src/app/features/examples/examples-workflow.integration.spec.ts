import { TestBed } from '@angular/core/testing';
import { ExamplesWorkflowFacade } from './examples-workflow.facade';
import { ExamplesGraphStateService } from './visualization-state.service';
import { SimulationStateService } from './simulation-state.service';
import { ReconstructionStateService } from './reconstruction-state.service';

describe('ExamplesWorkflowFacade Integration', () => {
  let facade: ExamplesWorkflowFacade;
  let graphState: ExamplesGraphStateService;
  let simulation: SimulationStateService;
  let reconstruction: ReconstructionStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    facade = TestBed.inject(ExamplesWorkflowFacade);
    graphState = TestBed.inject(ExamplesGraphStateService);
    simulation = TestBed.inject(SimulationStateService);
    reconstruction = TestBed.inject(ReconstructionStateService);
  });

  it('runs a full step scenario from 0 to 6 while preserving simulation from 4 to 6', () => {
    expect(facade.step()).toBe(0);

    facade.startStep();
    expect(facade.step()).toBe(1);

    facade.nextStep(); // 1 -> 2
    facade.nextStep(); // 2 -> 3
    expect(facade.step()).toBe(3);

    simulation.counters.set({ eA: 2 });
    reconstruction.reconCounters.set({ eB: 1 });

    facade.nextStep(); // 3 -> 4, should reset derived state
    expect(facade.step()).toBe(4);
    expect(simulation.counters()).toEqual({});
    expect(reconstruction.reconCounters()).toEqual({});

    simulation.counters.set({ eA: 7 });
    reconstruction.reconCounters.set({ eB: 3 });

    facade.nextStep(); // 4 -> 5, should preserve state
    expect(facade.step()).toBe(5);
    expect(simulation.counters()).toEqual({ eA: 7 });
    expect(reconstruction.reconCounters()).toEqual({ eB: 3 });

    facade.nextStep(); // 5 -> 6, should preserve state
    expect(facade.step()).toBe(6);
    expect(simulation.counters()).toEqual({ eA: 7 });
    expect(reconstruction.reconCounters()).toEqual({ eB: 3 });
  });

  it('keeps simulation and clears reconstruction on 5 -> 4 transition', () => {
    graphState.step.set(5);
    simulation.counters.set({ e1: 11 });
    reconstruction.reconCounters.set({ e2: 6 });

    facade.prevStep();

    expect(facade.step()).toBe(4);
    expect(simulation.counters()).toEqual({ e1: 11 });
    expect(reconstruction.reconCounters()).toEqual({});
  });

  it('resets all derived state when changing example', () => {
    graphState.step.set(4);
    simulation.counters.set({ e1: 4 });
    reconstruction.reconCounters.set({ e2: 5 });

    const currentExampleId = facade.selectedId();
    facade.pickExample(currentExampleId);

    expect(facade.step()).toBe(0);
    expect(simulation.counters()).toEqual({});
    expect(reconstruction.reconCounters()).toEqual({});
  });

  it('forwards simulation config updates through facade', () => {
    facade.setRuns(9);
    facade.setSpeed(2.5);

    expect(facade.runs()).toBe(9);
    expect(facade.speed()).toBe(2.5);
  });

  it('accepts only supported layouts', () => {
    facade.setLayout('elk');
    expect(facade.layoutName()).toBe('elk');

    facade.setLayout('invalid-layout');
    expect(facade.layoutName()).toBe('elk');
  });
});
