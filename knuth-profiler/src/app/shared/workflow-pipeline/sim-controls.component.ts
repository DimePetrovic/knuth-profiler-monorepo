import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ExamplesWorkflowFacade } from '../../features/examples/examples-workflow.facade';

@Component({
  selector: 'app-sim-controls',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sim-controls.component.html',
})
export class SimControlsComponent {
  @Input({ required: true }) facade!: ExamplesWorkflowFacade;
}
