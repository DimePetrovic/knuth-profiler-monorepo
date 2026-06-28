import { TestBed } from '@angular/core/testing';
import { WorkflowReportService } from './workflow-report.service';
import { GraphData } from '../../core/graph/graph.types';

describe('WorkflowReportService', () => {
  let service: WorkflowReportService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WorkflowReportService);
  });

  it('builds source lines with highlight hints from node ranges', () => {
    const graph: GraphData = {
      nodes: [
        { id: 'ENTRY', label: 'ENTRY', kind: 'entry' },
        { id: 'n1', label: 'x = 1', kind: 'normal', data: { range: 2 } },
        { id: 'EXIT', label: 'EXIT', kind: 'exit' },
      ],
      edges: [
        { id: 'e0', source: 'ENTRY', target: 'n1', kind: 'normal', weight: 1 },
        { id: 'e1', source: 'n1', target: 'EXIT', kind: 'normal', weight: 1 },
      ],
    };

    const lines = service.buildSourceLines(
      graph,
      { filename: 'main.c', language: 'c', source: 'int main() {\n  x = 1;\n}' },
      ['e0', 'e1'],
    );

    expect(lines[1].highlighted).toBeTrue();
  });

  it('returns example snippet for known example id', () => {
    expect(service.getExampleSourceSnippet('if-else')?.filename).toBe('if-else.c');
  });
});
