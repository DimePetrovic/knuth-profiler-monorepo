import { TestBed } from '@angular/core/testing';

import { ReconstructionStateService } from './reconstruction-state.service';

describe('ReconstructionStateService', () => {
  let service: ReconstructionStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ReconstructionStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
  describe('State Initialization', () => {
    it('should start with empty state', () => {
      expect(service.reconCounters()).toEqual({});
      expect(service.steps()).toEqual([]);
      expect(service.idx()).toBe(-1);
    });
  });

  describe('Reset', () => {
    it('should clear all state on reset', () => {
      // Manually set some state
      service.reconCounters.set({ e1: 5 });
      service.steps.set([{ message: 'test' }] as any);
      service.idx.set(0);

      service.reset();

      expect(service.reconCounters()).toEqual({});
      expect(service.steps()).toEqual([]);
      expect(service.idx()).toBe(-1);
    });
  });

  describe('Step Browsing', () => {
    it('should not advance beyond array bounds', () => {
      // Empty steps
      expect(service.next()).toBeNull();
      expect(service.prev()).toBeNull();
    });

    it('should navigate steps when available', () => {
      const dummySteps = [
        { solvedEdgeId: 'e1' },
        { solvedEdgeId: 'e2' },
        { solvedEdgeId: 'e3' }
      ] as any;

      service.steps.set(dummySteps);
      service.idx.set(0);

      const next = service.next();
      expect(next?.solvedEdgeId).toBe('e2');
      expect(service.idx()).toBe(1);

      const prev = service.prev();
      expect(prev?.solvedEdgeId).toBe('e1');
      expect(service.idx()).toBe(0);
    });
  });

  describe('Merged Counters', () => {
    it('should merge simulation and reconstruction counters', () => {
      const sim = TestBed.inject(SimulationStateService);
      sim.counters.set({ e1: 10, e2: 5 });

      service.reconCounters.set({ e3: 7 });

      const merged = service.mergedCounters();
      expect(merged).toEqual({ e1: 10, e2: 5, e3: 7 });
    });

    it('should prioritize reconstruction counts over simulation', () => {
      const sim = TestBed.inject(SimulationStateService);
      sim.counters.set({ e1: 10 });

      service.reconCounters.set({ e1: 15 });

      const merged = service.mergedCounters();
      expect(merged['e1']).toBe(15); // reconstruction value overrides
    });
  });
});

// Import needed for merged counters test
import { SimulationStateService } from './simulation-state.service';
