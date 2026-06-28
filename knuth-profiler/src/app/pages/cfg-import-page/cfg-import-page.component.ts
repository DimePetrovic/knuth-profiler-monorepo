import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ExamplesWorkflowFacade } from '../../features/examples/examples-workflow.facade';
import { CfgImportApiService } from '../../features/cfg-import/cfg-import.api.service';
import { mapCfgJsonToGraphData } from '../../features/cfg-import/cfg-import.adapter';
import { CfgJobPollingService } from '../../features/cfg-import/cfg-job-polling.service';
import { CfgErrorJson, CfgImportViewState, CfgLanguage, CfgResultJson } from '../../features/cfg-import/cfg-import.types';
import { getWorkflowStepMetadata } from '../../features/examples/workflow-step-metadata';
import { GraphCanvasComponent } from '../../shared/graph-canvas/graph-canvas.component';
import { WorkflowPipelineComponent } from '../../shared/workflow-pipeline/workflow-pipeline.component';
import { CfgImportSourceEditorComponent } from './cfg-import-source-editor.component';
import { CfgImportStatusComponent } from './cfg-import-status.component';

const LANGUAGE_PRESETS: Record<CfgLanguage, { filename: string; source: string; extensions: readonly string[] }> = {
  c: {
    filename: 'main.c',
    source: 'int main() {\n  return 0;\n}',
    extensions: ['.c', '.h'],
  },
  cpp: {
    filename: 'main.cpp',
    source: '#include <iostream>\n\nint main() {\n  std::cout << "Hello" << std::endl;\n  return 0;\n}',
    extensions: ['.cpp', '.cc', '.cxx', '.hpp', '.hh', '.hxx'],
  },
  java: {
    filename: 'Main.java',
    source: 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello");\n  }\n}',
    extensions: ['.java'],
  },
  python: {
    filename: 'main.py',
    source: 'def main():\n  print("Hello")\n\n\nif __name__ == "__main__":\n  main()',
    extensions: ['.py'],
  },
  javascript: {
    filename: 'main.js',
    source: 'function main() {\n  console.log("Hello");\n}\n\nmain();',
    extensions: ['.js', '.mjs', '.cjs'],
  },
};

@Component({
  selector: 'app-cfg-import-page',
  standalone: true,
  providers: [CfgJobPollingService],
  imports: [
    CommonModule,
    FormsModule,
    GraphCanvasComponent,
    WorkflowPipelineComponent,
    CfgImportSourceEditorComponent,
    CfgImportStatusComponent,
  ],
  templateUrl: './cfg-import-page.component.html',
})
export class CfgImportPageComponent implements OnDestroy {
  private readonly api = inject(CfgImportApiService);
  private readonly polling = inject(CfgJobPollingService);
  readonly workflow = inject(ExamplesWorkflowFacade);

  readonly language = signal<CfgLanguage>('c');
  readonly filename = signal(LANGUAGE_PRESETS.c.filename);
  readonly source = signal(LANGUAGE_PRESETS.c.source);
  readonly isSourceLocked = signal(false);
  readonly isSubmitting = signal(false);
  readonly message = signal<string | null>(null);

  readonly state = signal<CfgImportViewState>({
    jobId: null,
    status: null,
    result: null,
    error: null,
    graphData: null,
  });

  readonly workflowTitle = computed(() => {
    return getWorkflowStepMetadata(this.workflow.step()).cfgPageTitle;
  });

  readonly workflowSubtitle = computed(() => {
    return getWorkflowStepMetadata(this.workflow.step()).cfgSubtitle;
  });

  constructor() {
    this.workflow.enterCfgPage();
  }

  ngOnDestroy(): void {
    this.polling.stop();
  }

  onLanguageChange(language: CfgLanguage): void {
    this.language.set(language);
    this.applyLanguagePreset(language);
    this.isSourceLocked.set(false);
  }

  async submitSource(): Promise<void> {
    this.resetStateForSubmit();
    this.workflow.setReportSourceArtifact({
      filename: this.filename(),
      language: this.language(),
      source: this.source(),
    });
    try {
      const jobId = await this.api.createJobFromSource(
        this.language(),
        this.filename(),
        this.source()
      );
      this.state.update(s => ({ ...s, jobId }));
      this.startPolling(jobId);
    } catch (error) {
      this.message.set(toErrorMessage(error));
      this.isSubmitting.set(false);
    }
  }

  async uploadFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.resetStateForSubmit();
    const detectedLanguage = this.detectLanguageFromFilename(file.name);
    if (detectedLanguage) {
      this.language.set(detectedLanguage);
      this.applyLanguagePreset(detectedLanguage);
    }

    let uploadedSource = this.source();
    try {
      const text = await file.text();
      if (text.trim().length > 0) {
        uploadedSource = text;
      }
    } catch {
      // Keep current source if uploaded file is not readable as text.
    }

    this.filename.set(file.name);
    this.source.set(uploadedSource);
    this.isSourceLocked.set(true);
    this.workflow.setReportSourceArtifact({
      filename: file.name,
      language: this.language(),
      source: uploadedSource,
    });

    try {
      const jobId = await this.api.createJobFromUpload(this.language(), file);
      this.state.update(s => ({ ...s, jobId }));
      this.startPolling(jobId);
    } catch (error) {
      this.message.set(toErrorMessage(error));
      this.isSubmitting.set(false);
    } finally {
      input.value = '';
    }
  }

  private startPolling(jobId: string): void {
    this.polling.start(jobId, pollId => this.pollOnce(pollId));
  }

  private async pollOnce(jobId: string): Promise<boolean> {
    try {
      const status = await this.api.getStatus(jobId);
      this.state.update(s => ({ ...s, status }));

      const resultState = await this.api.getResult(jobId);
      if (resultState.pending) {
        return true;
      }

      this.polling.stop();
      this.isSubmitting.set(false);

      const payload = resultState.result;
      if (payload.version === 'cfg-error-1') {
        this.state.update(s => ({ ...s, error: payload as CfgErrorJson }));
        this.message.set(`${payload.code}: ${payload.message}`);
        return false;
      }

      const cfg = payload as CfgResultJson;
      const graphData = mapCfgJsonToGraphData(cfg);

      this.state.update(s => ({
        ...s,
        result: cfg,
        graphData,
      }));
      this.workflow.loadImportedGraph(graphData);
      this.message.set('CFG је спреман. Покрени визуализацију кроз кораке као на примерима.');
      return false;
    } catch (error) {
      this.polling.stop();
      this.isSubmitting.set(false);
      this.message.set(toErrorMessage(error));
      return false;
    }
  }

  private stopPolling(): void {
    this.polling.stop();
  }

  private resetStateForSubmit(): void {
    this.stopPolling();
    this.workflow.clearImportedGraph();
    this.isSubmitting.set(true);
    this.message.set(null);
    this.state.set({
      jobId: null,
      status: null,
      result: null,
      error: null,
      graphData: null,
    });
  }

  private applyLanguagePreset(language: CfgLanguage): void {
    const preset = LANGUAGE_PRESETS[language];
    this.filename.set(preset.filename);
    this.source.set(preset.source);
  }

  private detectLanguageFromFilename(filename: string): CfgLanguage | null {
    const lower = filename.toLowerCase();
    const languages = Object.keys(LANGUAGE_PRESETS) as CfgLanguage[];
    for (const language of languages) {
      if (LANGUAGE_PRESETS[language].extensions.some(ext => lower.endsWith(ext))) {
        return language;
      }
    }
    return null;
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Непозната грешка.';
}
