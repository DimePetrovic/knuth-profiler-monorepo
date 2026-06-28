import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { CfgErrorJson } from '../../features/cfg-import/cfg-import.types';

@Component({
  selector: 'app-cfg-import-status',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="error as err" class="border rounded-xl p-4 bg-red-50 text-sm">
      <div class="font-medium text-red-700">Грешка: {{ err.code }}</div>
      <div class="text-red-700">{{ err.message }}</div>
      <div class="text-red-700">Фаза: {{ err.stage }}</div>
    </div>
  `,
})
export class CfgImportStatusComponent {
  @Input() error: CfgErrorJson | null = null;
}
