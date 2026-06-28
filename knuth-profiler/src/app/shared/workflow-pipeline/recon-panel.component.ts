import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ExamplesWorkflowFacade } from '../../features/examples/examples-workflow.facade';

@Component({
  selector: 'app-recon-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './recon-panel.component.html',
})
export class ReconPanelComponent {
  @Input({ required: true }) facade!: ExamplesWorkflowFacade;
}
