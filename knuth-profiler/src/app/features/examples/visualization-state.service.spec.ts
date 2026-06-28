import { TestBed } from '@angular/core/testing';
import { ExamplesGraphStateService } from './visualization-state.service';

describe('VisualizationStateService', () => {
  let service: ExamplesGraphStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ExamplesGraphStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Initial State', () => {
    it('should start with step 0', () => {
      expect(service.step()).toBe(0);
      expect(service.graphData()).toBeDefined();
    });

    it('should have default layout', () => {
      expect(service.layout()).toBe('dagre');
    });
  });

  describe('Step Navigation', () => {
    it('should move to next step', () => {
      service.next();
      expect(service.step()).toBe(1);
    });

    it('should move to previous step', () => {
      service.step.set(2);
      service.prev();
      expect(service.step()).toBe(1);
    });

    it('should start at weights view', () => {
      service.start();
      expect(service.step()).toBe(1);
    });

    it('should reset to initial state', () => {
      service.step.set(6);
      service.reset();
      expect(service.step()).toBe(0);
    });

    it('should cap at report step', () => {
      service.step.set(6);
      service.next();
      expect(service.step()).toBe(6);
    });
  });

  describe('Configuration', () => {
    it('should change selected example', () => {
      service.pickExample('fibonacci');
      expect(service.selectedId()).toBe('fibonacci');
    });

    it('should reset step when changing example', () => {
      service.step.set(3);
      service.pickExample('fibonacci');
      expect(service.step()).toBe(0);
    });

    it('should update layout', () => {
      service.layout.set('elk');
      expect(service.layout()).toBe('elk');
    });
  });

  describe('Derived State', () => {
    it('should have computed MST edge IDs', () => {
      expect(Array.isArray(service.mstEdgeIds())).toBe(true);
    });

    it('should have computed instrumented edge IDs', () => {
      expect(Array.isArray(service.instrumentedEdgeIds())).toBe(true);
    });

    it('should have overlay struct', () => {
      const ov = service.overlay();
      expect(ov).toBeDefined();
      expect(typeof ov.showWeights === 'boolean').toBe(true);
    });
  });
});
