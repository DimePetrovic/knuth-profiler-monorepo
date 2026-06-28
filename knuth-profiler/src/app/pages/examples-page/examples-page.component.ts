import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExamplesWorkflowFacade } from '../../features/examples/examples-workflow.facade';
import { getWorkflowStepMetadata } from '../../features/examples/workflow-step-metadata';
import { GraphCanvasComponent } from '../../shared/graph-canvas/graph-canvas.component';
import { WorkflowPipelineComponent } from '../../shared/workflow-pipeline/workflow-pipeline.component';

@Component({
  selector: 'app-examples-page',
  standalone: true,
  imports: [CommonModule, GraphCanvasComponent, WorkflowPipelineComponent],
  templateUrl: './examples-page.component.html'
})
export class ExamplesPageComponent {
  protected readonly facade = inject(ExamplesWorkflowFacade);

  protected readonly workflowSubtitle = computed(() => getWorkflowStepMetadata(this.facade.step()).examplesSubtitle);

  constructor() {
    this.facade.enterExamplesPage();
  }
}
