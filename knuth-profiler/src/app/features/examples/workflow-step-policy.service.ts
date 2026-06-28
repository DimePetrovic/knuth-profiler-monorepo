import { Injectable } from '@angular/core';
import { VizStep } from '../../core/graph/graph.types';

export interface WorkflowProgressSnapshot {
  step: VizStep;
  isCfgContext: boolean;
  graphReady: boolean;
  hasSimulationData: boolean;
  isRunning: boolean;
  currentRun: number;
  configuredRuns: number;
  pendingTreeEdges: number;
}

@Injectable({ providedIn: 'root' })
export class WorkflowStepPolicyService {
  getSimulationStatusLabel(snapshot: Pick<WorkflowProgressSnapshot, 'isRunning' | 'currentRun' | 'configuredRuns' | 'hasSimulationData'> & { isPaused: boolean }): string {
    if (snapshot.isRunning && !snapshot.isPaused) {
      return 'Ради';
    }

    if (snapshot.isRunning && snapshot.isPaused) {
      return 'Пауза';
    }

    if (!snapshot.isRunning && snapshot.currentRun >= snapshot.configuredRuns && snapshot.hasSimulationData) {
      return 'Завршено';
    }

    return 'Стојеће';
  }

  canProceed(snapshot: WorkflowProgressSnapshot): boolean {
    if (snapshot.step === 0) {
      return snapshot.graphReady;
    }

    if (snapshot.step >= 1 && snapshot.step <= 3) {
      return snapshot.graphReady;
    }

    if (snapshot.step === 4) {
      return snapshot.hasSimulationData && !snapshot.isRunning && snapshot.currentRun >= snapshot.configuredRuns;
    }

    if (snapshot.step === 5) {
      return snapshot.pendingTreeEdges === 0;
    }

    return false;
  }

  nextBlockedReason(snapshot: WorkflowProgressSnapshot): string | null {
    if (snapshot.step === 0 && !snapshot.graphReady) {
      return snapshot.isCfgContext
        ? 'Учитај CFG граф и сачекај успешну обраду да откључаш следећи корак.'
        : 'Изабери пример да откључаш следећи корак.';
    }

    if (snapshot.step >= 1 && snapshot.step <= 3 && !snapshot.graphReady) {
      return 'Граф није спреман за следећи корак.';
    }

    if (snapshot.step === 4) {
      if (snapshot.isRunning) {
        return 'Сачекај да се симулација заврши или је ручно заустави пре преласка на реконструкцију.';
      }
      if (snapshot.currentRun < snapshot.configuredRuns) {
        return 'Сачекај да се заврше сви пролази кроз граф (статус: Завршено) пре преласка на реконструкцију.';
      }
      if (!snapshot.hasSimulationData) {
        return 'Покрени симулацију да би се појавили бројачи и откључала реконструкција.';
      }
    }

    if (snapshot.step === 5 && snapshot.pendingTreeEdges > 0) {
      return 'Израчунај све преостале MST гране пре преласка на извештај.';
    }

    return null;
  }

  shouldPreserveSimulationState(before: VizStep, after: VizStep): boolean {
    return (
      (before === 4 && after === 5) ||
      (before === 5 && after === 4) ||
      (before === 5 && after === 6) ||
      (before === 6 && after === 5)
    );
  }

  shouldResetReconstruction(before: VizStep, after: VizStep): boolean {
    const leftReconstruction = (before === 5 || before === 6) && after < 5;
    return after < 5 || leftReconstruction;
  }
}
