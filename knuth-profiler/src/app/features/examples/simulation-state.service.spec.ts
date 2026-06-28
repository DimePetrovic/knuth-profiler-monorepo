import { TestBed } from '@angular/core/testing';

import { SimulationStateService } from './simulation-state.service';

describe('SimulationStateService', () => {
  let service: SimulationStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SimulationStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
  describe('Configuration', () => {
    it('should update run count', () => {
      service.setRuns(10);
      expect(service.config().runs).toBe(10);
    });

    it('should clamp run count to minimum 0', () => {
      service.setRuns(0);
      expect(service.config().runs).toBe(0);
    });

    it('should normalize NaN run count to 0', () => {
      service.setRuns(Number.NaN);
      expect(service.config().runs).toBe(0);
    });

    it('should update speed', () => {
      service.setSpeed(2);
      expect(service.config().speed).toBe(2);
    });

    it('should clamp speed between 0.25 and 3', () => {
      service.setSpeed(5);
      expect(service.config().speed).toBe(3);

      service.setSpeed(0.1);
      expect(service.config().speed).toBe(0.25);
    });

    it('should toggle fastMode', () => {
      service.setFastMode(true);
      expect(service.config().fastMode).toBe(true);

      service.setFastMode(false);
      expect(service.config().fastMode).toBe(false);
    });
  });

  describe('State Management', () => {
    it('should initialize in stopped state', () => {
      expect(service.isRunning()).toBe(false);
      expect(service.isPaused()).toBe(false);
      expect(service.currentRun()).toBe(0);
      expect(service.currentNodeId()).toBe(null);
      expect(service.currentEdgeId()).toBe(null);
    });

    it('should reset all state', () => {
      service.config.set({ runs: 5, maxStepsPerRun: 100, speed: 2, fastMode: true });
      service.currentRun.set(3);
      service.currentNodeId.set('A');
      service.counters.set({ e1: 10 });
      service.isConfigLocked.set(true);

      service.reset();

      expect(service.currentRun()).toBe(0);
      expect(service.currentNodeId()).toBe(null);
      expect(service.currentEdgeId()).toBe(null);
      expect(service.counters()).toEqual({});
      expect(service.isRunning()).toBe(false);
      expect(service.isConfigLocked()).toBe(false);
    });

    it('should provide overlay for canvas', () => {
      const overlay = service.simOverlay();
      expect(overlay.counters).toEqual(service.counters());
      expect(overlay.currentNodeId).toBe(service.currentNodeId());
      expect(overlay.currentEdgeId).toBe(service.currentEdgeId());
    });
  });
});

describe('SimulationStateService – state machine and locking', () => {
  let service: SimulationStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SimulationStateService);
  });

  describe('pause / resume / stop transitions', () => {
    it('pause sets isPaused when running', () => {
      service.isRunning.set(true);
      service.pause();
      expect(service.isPaused()).toBeTrue();
      expect(service.isRunning()).toBeTrue();
    });

    it('pause is a no-op when not running', () => {
      service.pause();
      expect(service.isPaused()).toBeFalse();
    });

    it('stop clears running and paused flags and nulls node/edge', () => {
      service.isRunning.set(true);
      service.isPaused.set(true);
      service.currentNodeId.set('n1');
      service.currentEdgeId.set('e1');
      service.stop();
      expect(service.isRunning()).toBeFalse();
      expect(service.isPaused()).toBeFalse();
      expect(service.currentNodeId()).toBeNull();
      expect(service.currentEdgeId()).toBeNull();
    });

    it('resume clears isPaused when running and paused', () => {
      service.isRunning.set(true);
      service.isPaused.set(true);
      service.resume();
      expect(service.isPaused()).toBeFalse();
    });

    it('resume is a no-op when not running', () => {
      service.isPaused.set(true);
      service.resume();
      expect(service.isPaused()).toBeTrue();
    });

    it('resume is a no-op when running but not paused', () => {
      service.isRunning.set(true);
      service.isPaused.set(false);
      service.resume();
      expect(service.isPaused()).toBeFalse();
    });
  });

  describe('config locking', () => {
    it('setRuns is blocked while config is locked', () => {
      service.isConfigLocked.set(true);
      service.setRuns(99);
      expect(service.config().runs).not.toBe(99);
    });

    it('reset always unlocks config', () => {
      service.isConfigLocked.set(true);
      service.reset();
      expect(service.isConfigLocked()).toBeFalse();
    });
  });

  describe('setSpeed edge cases', () => {
    it('normalizes NaN speed to max (3)', () => {
      service.setSpeed(Number.NaN);
      expect(service.config().speed).toBe(3);
    });

    it('clamps below-minimum speed to 0.25', () => {
      service.setSpeed(0);
      expect(service.config().speed).toBe(0.25);
    });

    it('clamps above-maximum speed to 3', () => {
      service.setSpeed(100);
      expect(service.config().speed).toBe(3);
    });
  });
});
