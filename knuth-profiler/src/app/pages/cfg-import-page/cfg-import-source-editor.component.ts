import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CfgImportViewState, CfgLanguage } from '../../features/cfg-import/cfg-import.types';

@Component({
  selector: 'app-cfg-import-source-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cfg-import-source-editor.component.html',
})
export class CfgImportSourceEditorComponent {
  @Input({ required: true }) language!: CfgLanguage;
  @Input({ required: true }) filename!: string;
  @Input({ required: true }) source!: string;
  @Input({ required: true }) isSourceLocked!: boolean;
  @Input({ required: true }) isSubmitting!: boolean;
  @Input({ required: true }) state!: CfgImportViewState;
  @Input() message: string | null = null;

  @Output() languageChange = new EventEmitter<CfgLanguage>();
  @Output() filenameChange = new EventEmitter<string>();
  @Output() sourceChange = new EventEmitter<string>();
  @Output() submitSource = new EventEmitter<void>();
  @Output() uploadFile = new EventEmitter<Event>();
}
