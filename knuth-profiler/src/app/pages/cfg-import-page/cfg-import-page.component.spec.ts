/// <reference types="jasmine" />

import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';

import { CfgImportApiService } from '../../features/cfg-import/cfg-import.api.service';
import { CfgImportPageComponent } from './cfg-import-page.component';

describe('CfgImportPageComponent', () => {
  let fixture: ComponentFixture<CfgImportPageComponent>;
  let component: CfgImportPageComponent;
  let api: jasmine.SpyObj<CfgImportApiService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<CfgImportApiService>('CfgImportApiService', [
      'createJobFromSource',
      'createJobFromUpload',
      'getStatus',
      'getResult',
    ]);

    await TestBed.configureTestingModule({
      imports: [CfgImportPageComponent],
      providers: [{ provide: CfgImportApiService, useValue: api }],
    }).compileComponents();

    fixture = TestBed.createComponent(CfgImportPageComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should update filename and source preset when language changes', () => {
    component.onLanguageChange('python');

    expect(component.language()).toBe('python');
    expect(component.filename()).toBe('main.py');
    expect(component.source()).toContain('def main():');
    expect(component.isSourceLocked()).toBeFalse();
  });

  it('should infer language from uploaded filename and lock source editor', async () => {
    api.createJobFromUpload.and.rejectWith(new Error('upload failed'));
    const file = new File(['class Main {}'], 'Main.java', { type: 'text/plain' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });

    await component.uploadFile({ target: input } as unknown as Event);

    expect(component.language()).toBe('java');
    expect(component.filename()).toBe('Main.java');
    expect(component.isSourceLocked()).toBeTrue();
    expect(api.createJobFromUpload).toHaveBeenCalledWith('java', file);
  });

  it('should run source submission scenario and populate graph', fakeAsync(() => {
    api.createJobFromSource.and.resolveTo('job-1');
    api.getStatus.and.resolveTo({
      jobId: 'job-1',
      status: 'running',
      stage: 'joern',
      createdAt: '2026-04-01T00:00:00.000Z',
      startedAt: '2026-04-01T00:00:01.000Z',
      finishedAt: null,
      error: null,
    } as any);

    api.getResult.and.returnValues(
      Promise.resolve({ pending: true } as const),
      Promise.resolve({
        pending: false as const,
        result: {
          version: 'cfg-json-1',
          language: 'c',
          filename: 'main.c',
          sourceHash: 'sha256:x',
          graph: {
            entryNodeId: 'n0',
            exitNodeId: 'n2',
            nodes: [
              { id: 'n0', kind: 'entry', label: 'ENTRY', range: null },
              { id: 'n1', kind: 'stmt', label: 'x=1', range: null },
              { id: 'n2', kind: 'exit', label: 'EXIT', range: null },
            ],
            edges: [
              { from: 'n0', to: 'n1', kind: 'next', label: '' },
              { from: 'n1', to: 'n2', kind: 'next', label: '' },
            ],
          },
        },
      })
    );

    void component.submitSource();
    flushMicrotasks();

    // first immediate poll => pending
    expect(component.state().jobId).toBe('job-1');
    expect(component.state().graphData).toBeNull();

    tick(1000);
    flushMicrotasks();

    expect(component.state().result?.version).toBe('cfg-json-1');
    expect(component.state().graphData).toBeTruthy();
    expect(component.message()).toContain('CFG је спреман');

    const data = component.state().graphData!;
    expect(data.nodes.some(n => n.id === 'ENTRY')).toBeTrue();
    expect(data.nodes.some(n => n.id === 'EXIT')).toBeTrue();
    expect(data.edges.some(e => e.id === '__entry_sentinel__')).toBeTrue();
    expect(data.edges.some(e => e.id === '__exit_sentinel__')).toBeTrue();
  }));
});
