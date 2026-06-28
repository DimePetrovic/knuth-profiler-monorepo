import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ExamplesWorkflowFacade } from '../../features/examples/examples-workflow.facade';

@Component({
  selector: 'app-report-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './report-panel.component.html',
})
export class ReportPanelComponent {
  @Input({ required: true }) facade!: ExamplesWorkflowFacade;
}
