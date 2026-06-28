import { TestBed } from '@angular/core/testing';
import { WorkflowStepPolicyService } from './workflow-step-policy.service';

describe('WorkflowStepPolicyService', () => {
  let service: WorkflowStepPolicyService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WorkflowStepPolicyService);
  });

  it('returns cfg-specific blocked reason on step 0', () => {
    expect(service.nextBlockedReason({
      step: 0,
      isCfgContext: true,
      graphReady: false,
      hasSimulationData: false,
      isRunning: false,
      currentRun: 0,
      configuredRuns: 20,
      pendingTreeEdges: 0,
    })).toContain('CFG');
  });

  it('preserves simulation state from step 5 to 6', () => {
    expect(service.shouldPreserveSimulationState(5, 6)).toBeTrue();
  });
});
