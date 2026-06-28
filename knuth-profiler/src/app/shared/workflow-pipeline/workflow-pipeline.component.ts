import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ExamplesWorkflowFacade } from '../../features/examples/examples-workflow.facade';
import { ReportPdfExportService } from '../../features/examples/report-pdf-export.service';
import { WORKFLOW_STEP_SEQUENCE } from '../../features/examples/workflow-step-metadata';
import { SimControlsComponent } from './sim-controls.component';
import { ReconPanelComponent } from './recon-panel.component';
import { ReportPanelComponent } from './report-panel.component';

@Component({
  selector: 'app-workflow-pipeline',
  standalone: true,
  imports: [CommonModule, SimControlsComponent, ReconPanelComponent, ReportPanelComponent],
  templateUrl: './workflow-pipeline.component.html',
})
export class WorkflowPipelineComponent {
  private readonly router = inject(Router);
  private readonly reportPdfExport = inject(ReportPdfExportService);
  protected isExportingPdf = false;
  protected showCodePreview = false;
  @Input({ required: true }) facade!: ExamplesWorkflowFacade;
  @Input() title = 'Ток рада';
  @Input() subtitle = '';
  @Input() firstStepTitle = 'Корак 1';

  protected readonly stepTitles = WORKFLOW_STEP_SEQUENCE.map(step => step.badgeTitle);

  stepState(idx: number): 'completed' | 'current' | 'locked' {
    const current = this.facade.step();
    if (idx < current) {
      return 'completed';
    }
    if (idx === current) {
      return 'current';
    }
    return 'locked';
  }

  stepHint(idx: number): string {
    const state = this.stepState(idx);
    if (state === 'completed') {
      return 'Завршено';
    }
    if (state === 'current') {
      return 'Активно';
    }
    return 'Закључано';
  }

  onNext(): void {
    const step = this.facade.step();
    if (step === 0) {
      this.facade.startStep();
      return;
    }
    this.facade.nextStep();
  }

  onPrev(): void {
    this.facade.prevStep();
  }

  canGoNext(): boolean {
    return this.facade.canProceedFromCurrentStep();
  }

  toggleCodePreview(): void {
    this.showCodePreview = !this.showCodePreview;
  }

  async onFinish(): Promise<void> {
    this.facade.finishAndReset();
    await this.router.navigateByUrl('/');
  }

  async onExportReportPdf(): Promise<void> {
    const metrics = this.facade.reportMetrics();
    if (!metrics) {
      return;
    }

    this.isExportingPdf = true;
    try {
      await this.reportPdfExport.exportReport({
        title: this.title,
        runProgressText: this.facade.reportRunProgressText(),
        metrics,
        artifact: this.facade.reportCodeArtifact(),
        edgeRows: this.facade.reportInstrumentedEdges(),
        nodeRows: this.facade.reportNodeExecutions(),
      });
    } finally {
      this.isExportingPdf = false;
    }
  }
}
