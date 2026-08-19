import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { CfgErrorJson } from '../../features/cfg-import/cfg-import.types';
import { CfgLabelPipe } from '../../features/cfg-import/cfg-label.pipe';

@Component({
  selector: 'app-cfg-import-status',
  standalone: true,
  imports: [CommonModule, CfgLabelPipe],
  template: `
    <div *ngIf="error as err" class="border rounded-xl p-4 bg-red-50 text-sm">
      <div class="font-medium text-red-700">Грешка: {{ err.code | cfgLabel:'code' }}</div>
      <div class="text-red-700">{{ err.message }}</div>
      <div class="text-red-700">Фаза: {{ err.stage | cfgLabel:'stage' }}</div>
    </div>
  `,
})
export class CfgImportStatusComponent {
  @Input() error: CfgErrorJson | null = null;
}
