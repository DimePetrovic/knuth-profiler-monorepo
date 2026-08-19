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

  it('прикази n и e без граничних грана и помоћних чворова', () => {
    // Isti primer koji rad navodi u tabeli sazetka: n = 3, e = 2, |S| = 0.
    const graph: GraphData = {
      nodes: [
        { id: 'ENTRY', label: 'ENTRY', kind: 'entry' },
        { id: 'A', label: 'A', kind: 'normal' },
        { id: 'EXIT', label: 'EXIT', kind: 'exit' },
        { id: '__ghost_in__', label: '', kind: 'normal' },
        { id: '__ghost_out__', label: '', kind: 'ghost_out' },
      ],
      edges: [
        { id: 'e0', source: 'ENTRY', target: 'A', kind: 'normal', weight: 1 },
        { id: 'e1', source: 'A', target: 'EXIT', kind: 'normal', weight: 1 },
        { id: '__entry_sentinel__', source: '__ghost_in__', target: 'ENTRY', kind: 'entry', weight: 0 },
        { id: '__exit_sentinel__', source: 'EXIT', target: '__ghost_out__', kind: 'exit', weight: 0 },
      ],
    };

    const m = service.buildMetrics(graph, ['__entry_sentinel__'], {});

    expect(m.nodeCount).withContext('n не сме да броји помоћне чворове').toBe(3);
    expect(m.edgeCount).withContext('e не сме да броји граничне гране').toBe(2);
    // Приказани бројеви морају да задовоље једнакост из доказа оптималности.
    expect(m.instrumentedEdgeCount).toBe(m.edgeCount - m.nodeCount + 1);
  });
});
