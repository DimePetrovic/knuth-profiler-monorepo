import { Injectable } from '@angular/core';
import {
  WorkflowInstrumentedEdgeRow,
  WorkflowNodeExecutionRow,
  WorkflowReportCodeArtifact,
  WorkflowReportMetrics,
} from './workflow-report.models';

export interface ReportPdfExportPayload {
  title: string;
  runProgressText: string;
  metrics: WorkflowReportMetrics;
  artifact: WorkflowReportCodeArtifact | null;
  edgeRows: WorkflowInstrumentedEdgeRow[];
  nodeRows: WorkflowNodeExecutionRow[];
}

@Injectable({ providedIn: 'root' })
export class ReportPdfExportService {
  async exportReport(payload: ReportPdfExportPayload): Promise<void> {
    const exportBaseName = ((payload.artifact?.filename || payload.title)
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')) || 'izvestaj';
    const exportDate = new Intl.DateTimeFormat('sr-RS', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date());

    const [{ default: pdfMakeImport }, pdfFontsImport] = await Promise.all([
      import('pdfmake/build/pdfmake'),
      import('pdfmake/build/vfs_fonts'),
    ]);

    const pdfMake: any = (pdfMakeImport as any).default ?? pdfMakeImport;
    const vfs =
      (pdfFontsImport as any)?.default ??
      (pdfFontsImport as any)?.pdfMake?.vfs ??
      (pdfFontsImport as any)?.default?.pdfMake?.vfs;
    if (vfs && typeof pdfMake.addVirtualFileSystem === 'function') {
      pdfMake.addVirtualFileSystem(vfs);
    }

    const docDefinition = this.buildDocumentDefinition(payload, exportDate);
    pdfMake.createPdf(docDefinition).download(`izvestaj_profajliranja_${exportBaseName}.pdf`);
  }

  private buildDocumentDefinition(payload: ReportPdfExportPayload, exportDate: string): any {
    const formatPercent = (value: number): string => `${value.toFixed(2)}%`;
    const summaryTableBody: any[] = [
      [
        { text: 'Метрика', style: 'tableHeader' },
        { text: 'Вредност', style: 'tableHeader' },
      ],
      ['Број чворова', `${payload.metrics.nodeCount}`],
      ['Број грана', `${payload.metrics.edgeCount}`],
      ['Инструментисане гране', `${payload.metrics.instrumentedEdgeCount} (${formatPercent(payload.metrics.instrumentedEdgePercent)})`],
      ['Увећања бројача над инструментисаним гранама', `${payload.metrics.instrumentedOps}`],
      ['Увећања бројача при пуној инструментацији', `${payload.metrics.fullInstrumentationOps}`],
      ['Уштеђене операције над бројачима', `${payload.metrics.savedOps} (${formatPercent(payload.metrics.savedOpsPercent)})`],
    ];

    const edgeTableBody: any[] = [
      [
        { text: 'Грана', style: 'tableHeader' },
        { text: 'Ток', style: 'tableHeader' },
        { text: 'Бројач', style: 'tableHeader' },
      ],
      ...payload.edgeRows.map(row => [row.edgeId, `${row.sourceLabel} -> ${row.targetLabel}`, `${row.count}`]),
    ];

    const nodeTableBody: any[] = [
      [
        { text: 'Чвор', style: 'tableHeader' },
        { text: 'Ознака', style: 'tableHeader' },
        { text: 'Извршавања', style: 'tableHeader' },
        { text: 'Проценат по проласку', style: 'tableHeader' },
      ],
      ...payload.nodeRows.map(row => [row.nodeId, row.nodeLabel, `${row.executionCount}`, formatPercent(row.executionPercent)]),
    ];

    const codeContent = payload.artifact
      ? payload.artifact.source.split(/\r?\n/).map((line, idx) => ({ text: `${String(idx + 1).padStart(3, ' ')}  ${line}`, style: 'codeLine' }))
      : [];

    return {
      pageSize: 'A4',
      pageMargins: [40, 58, 40, 42],
      defaultStyle: {
        fontSize: 10,
      },
      header: (currentPage: number, pageCount: number) => ({
        margin: [40, 16, 40, 0],
        stack: [
          {
            columns: [
              { text: 'Knuth Profiler - Извештај', style: 'headerTitle' },
              { text: exportDate, style: 'headerMeta', alignment: 'right' },
            ],
          },
          {
            columns: [
              { text: payload.artifact ? `${payload.artifact.filename} | ${payload.artifact.language}` : payload.title, style: 'headerMeta' },
              { text: `Страна ${currentPage}/${pageCount}`, style: 'headerMeta', alignment: 'right' },
            ],
          },
          { canvas: [{ type: 'line', x1: 0, y1: 6, x2: 515, y2: 6, lineWidth: 0.8, lineColor: '#d1d5db' }] },
        ],
      }),
      footer: () => ({
        margin: [40, 0, 40, 8],
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.8, lineColor: '#d1d5db' }],
      }),
      content: [
        { text: 'Knuth Profiler - Извештај', style: 'h1' },
        { text: `Напредак покретања (извршено/подешено): ${payload.runProgressText}`, style: 'lead' },
        { text: 'Сажетак метрика', style: 'h2' },
        {
          table: {
            headerRows: 1,
            widths: ['*', '*'],
            body: summaryTableBody,
          },
          layout: 'lightHorizontalLines',
        },
        { text: 'Техничка корелација инструментације', style: 'h2' },
        { text: `Напредак покретања (извршено/подешено): ${payload.runProgressText}`, style: 'subtle' },
        payload.edgeRows.length > 0
          ? {
              table: {
                headerRows: 1,
                widths: [70, '*', 70],
                body: edgeTableBody,
              },
              layout: 'lightHorizontalLines',
            }
          : { text: 'Нема доступних инструментисаних грана.', style: 'subtle' },
        { text: 'Рангирање чворова по извршавању', style: 'h2' },
        { text: `Напредак покретања (извршено/подешено): ${payload.runProgressText}`, style: 'subtle' },
        payload.nodeRows.length > 0
          ? {
              table: {
                headerRows: 1,
                widths: [55, '*', 80, 120],
                body: nodeTableBody,
              },
              layout: 'lightHorizontalLines',
            }
          : { text: 'Подаци о извршавању чворова нису доступни.', style: 'subtle' },
        ...(payload.artifact
          ? [
              { text: 'Изворни артефакт', style: 'h2' },
              { text: `Датотека: ${payload.artifact.filename} | Језик: ${payload.artifact.language}`, style: 'subtle' },
              {
                stack: codeContent,
                style: 'codeBlock',
              },
            ]
          : []),
        { text: 'Закључак', style: 'h2' },
        {
          text:
            'Селективна инструментација заснована на Knuth-овом приступу смањује трошак ажурирања бројача у односу на пуну инструментацију свих грана. Код реалних софтверских система, са већим бројем датотека, гранања и извршних путања, овакав приступ постаје знатно важнији са становишта перформанси и скалабилности процеса профилирања.',
        },
      ],
      styles: {
        headerTitle: { fontSize: 11, bold: true, color: '#111827' },
        headerMeta: { fontSize: 8, color: '#4b5563' },
        h1: { fontSize: 18, bold: true, margin: [0, 0, 0, 8] },
        h2: { fontSize: 13, bold: true, margin: [0, 14, 0, 6] },
        lead: { margin: [0, 0, 0, 8] },
        subtle: { fontSize: 9, color: '#4b5563', margin: [0, 0, 0, 4] },
        tableHeader: { bold: true, color: '#111827' },
        codeBlock: { fontSize: 8, margin: [0, 4, 0, 0], fillColor: '#f8fafc' },
        codeLine: { fontSize: 8 },
      },
    };
  }
}
