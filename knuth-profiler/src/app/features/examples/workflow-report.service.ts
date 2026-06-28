import { Injectable } from '@angular/core';
import {
  ENTRY_NODE_ID,
  EXIT_NODE_ID,
  GHOST_IN_NODE_ID,
  GHOST_OUT_NODE_ID,
  isSentinelEdge,
} from '../../core/graph/graph.constants';
import { GraphData } from '../../core/graph/graph.types';
import {
  WorkflowInstrumentedEdgeRow,
  WorkflowNodeExecutionRow,
  WorkflowReportCodeArtifact,
  WorkflowReportMetrics,
  WorkflowReportSourceLine,
} from './workflow-report.models';

const EXAMPLE_SOURCE_SNIPPETS: Record<string, WorkflowReportCodeArtifact> = {
  'linear-flow': {
    filename: 'linear-flow.c',
    language: 'c',
    source: 'int linear_flow(int x) {\n  int a = x + 1;\n  int b = a * 2;\n  return b - 3;\n}',
  },
  'if-else': {
    filename: 'if-else.c',
    language: 'c',
    source: 'int classify(int x) {\n  if (x > 0) {\n    return 1;\n  } else {\n    return -1;\n  }\n}',
  },
  'while-loop': {
    filename: 'while-loop.c',
    language: 'c',
    source: 'int sum_to_n(int n) {\n  int i = 0;\n  int s = 0;\n  while (i < n) {\n    s += i;\n    i++;\n  }\n  return s;\n}',
  },
  'nested-loop': {
    filename: 'nested-loop.c',
    language: 'c',
    source: 'int nested(int n, int m) {\n  int c = 0;\n  for (int i = 0; i < n; i++) {\n    for (int j = 0; j < m; j++) {\n      c += i + j;\n    }\n  }\n  return c;\n}',
  },
  'switch-three': {
    filename: 'switch-three.c',
    language: 'c',
    source: 'int route(int x) {\n  switch (x) {\n    case 0: return 10;\n    case 1: return 20;\n    default: return 30;\n  }\n}',
  },
  'loop-if': {
    filename: 'loop-if.c',
    language: 'c',
    source: 'int loop_if(int n) {\n  int acc = 0;\n  while (n-- > 0) {\n    if ((n & 1) == 0) acc += 2;\n    else acc += 1;\n  }\n  return acc;\n}',
  },
};

@Injectable({ providedIn: 'root' })
export class WorkflowReportService {
  getExampleSourceSnippet(selectedId: string): WorkflowReportCodeArtifact | null {
    return EXAMPLE_SOURCE_SNIPPETS[selectedId] ?? null;
  }

  buildMetrics(
    graph: GraphData,
    instrumentedEdgeIds: string[],
    mergedCounters: Record<string, number>,
  ): WorkflowReportMetrics {
    const nonSentinelEdges = graph.edges.filter(edge => !isSentinelEdge(edge));
    const edgeCount = nonSentinelEdges.length;
    const nodeCount = graph.nodes.length;
    const instrumentedIds = new Set(instrumentedEdgeIds.filter(id => !id.startsWith('__')));
    const instrumentedEdgeCount = nonSentinelEdges.filter(edge => instrumentedIds.has(edge.id)).length;

    const fullInstrumentationOps = nonSentinelEdges.reduce(
      (sum, edge) => sum + (mergedCounters[edge.id] ?? 0),
      0,
    );
    const instrumentedOps = nonSentinelEdges.reduce(
      (sum, edge) => sum + (instrumentedIds.has(edge.id) ? (mergedCounters[edge.id] ?? 0) : 0),
      0,
    );

    const savedOps = Math.max(0, fullInstrumentationOps - instrumentedOps);
    const savedOpsPercent = fullInstrumentationOps > 0 ? (savedOps / fullInstrumentationOps) * 100 : 0;
    const instrumentedEdgePercent = edgeCount > 0 ? (instrumentedEdgeCount / edgeCount) * 100 : 0;

    return {
      nodeCount,
      edgeCount,
      instrumentedEdgeCount,
      instrumentedEdgePercent,
      instrumentedOps,
      fullInstrumentationOps,
      savedOps,
      savedOpsPercent,
    };
  }

  buildInstrumentedEdges(
    graph: GraphData,
    counters: Record<string, number>,
    instrumentedEdgeIds: string[],
  ): WorkflowInstrumentedEdgeRow[] {
    const nodeLabels = new Map(graph.nodes.map(node => [node.id, node.label ?? node.id]));
    const instrumentedIds = new Set(instrumentedEdgeIds.filter(id => !id.startsWith('__')));

    return graph.edges
      .filter(edge => !isSentinelEdge(edge) && instrumentedIds.has(edge.id))
      .map(edge => ({
        edgeId: edge.id,
        sourceLabel: nodeLabels.get(edge.source) ?? edge.source,
        targetLabel: nodeLabels.get(edge.target) ?? edge.target,
        count: counters[edge.id] ?? 0,
      }));
  }

  buildNodeExecutions(
    graph: GraphData,
    counters: Record<string, number>,
    configuredRuns: number,
  ): WorkflowNodeExecutionRow[] {
    const runs = Math.max(1, configuredRuns);
    const incoming = new Map<string, number>();
    const outgoing = new Map<string, number>();

    for (const edge of graph.edges) {
      if (isSentinelEdge(edge)) {
        continue;
      }
      const count = counters[edge.id] ?? 0;
      outgoing.set(edge.source, (outgoing.get(edge.source) ?? 0) + count);
      incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + count);
    }

    return graph.nodes
      .filter(node =>
        node.id !== ENTRY_NODE_ID &&
        node.id !== EXIT_NODE_ID &&
        node.id !== GHOST_IN_NODE_ID &&
        node.id !== GHOST_OUT_NODE_ID,
      )
      .map(node => {
        const inCount = incoming.get(node.id) ?? 0;
        const outCount = outgoing.get(node.id) ?? 0;
        return {
          nodeId: node.id,
          nodeLabel: node.label ?? node.id,
          executionCount: Math.max(inCount, outCount),
          executionPercent: (Math.max(inCount, outCount) / runs) * 100,
        };
      })
      .sort((a, b) => b.executionCount - a.executionCount || a.nodeLabel.localeCompare(b.nodeLabel));
  }

  buildSourceLines(
    graph: GraphData,
    artifact: WorkflowReportCodeArtifact,
    instrumentedEdgeIds: string[],
  ): WorkflowReportSourceLine[] {
    const lineHints = this.edgeLineHints(graph, artifact, instrumentedEdgeIds);
    const lineToEdges = new Map<number, string[]>();
    for (const [edgeId, lines] of lineHints.entries()) {
      for (const line of lines) {
        if (!lineToEdges.has(line)) {
          lineToEdges.set(line, []);
        }
        lineToEdges.get(line)!.push(edgeId);
      }
    }

    return artifact.source.split(/\r?\n/).map((text, idx) => {
      const lineNumber = idx + 1;
      const edgeIds = lineToEdges.get(lineNumber) ?? [];
      return {
        lineNumber,
        text,
        highlighted: edgeIds.length > 0,
        edgeIds,
      };
    });
  }

  private edgeLineHints(
    graph: GraphData,
    artifact: WorkflowReportCodeArtifact,
    instrumentedEdgeIds: string[],
  ): Map<string, number[]> {
    const sourceLines = artifact.source.split(/\r?\n/);
    const nodeById = new Map(graph.nodes.map(node => [node.id, node]));
    const instrumentedSet = new Set(instrumentedEdgeIds);
    const result = new Map<string, number[]>();

    for (const edge of graph.edges) {
      if (isSentinelEdge(edge) || !instrumentedSet.has(edge.id)) {
        continue;
      }

      const sourceNode = nodeById.get(edge.source);
      const targetNode = nodeById.get(edge.target);
      const explicitLines = new Set<number>();

      const sourceLine = extractLineNumberFromNode(sourceNode);
      const targetLine = extractLineNumberFromNode(targetNode);
      if (sourceLine !== null) {
        explicitLines.add(sourceLine);
      }
      if (targetLine !== null) {
        explicitLines.add(targetLine);
      }

      const hintLines = explicitLines.size > 0
        ? Array.from(explicitLines)
        : findLineHintsFromLabels(sourceLines, sourceNode?.label, targetNode?.label);

      if (hintLines.length > 0) {
        result.set(edge.id, hintLines);
      }
    }

    return result;
  }
}

function extractLineNumberFromNode(node: GraphData['nodes'][number] | undefined): number | null {
  const range = node?.data?.['range'];
  if (typeof range === 'number' && Number.isInteger(range) && range > 0) {
    return range;
  }

  if (!range || typeof range !== 'object') {
    return null;
  }

  const directKeys = ['line', 'lineNumber', 'startLine'];
  for (const key of directKeys) {
    const value = (range as Record<string, unknown>)[key];
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
      return value;
    }
  }

  const start = (range as Record<string, unknown>)['start'];
  if (start && typeof start === 'object') {
    const nested = (start as Record<string, unknown>)['line'];
    if (typeof nested === 'number' && Number.isInteger(nested) && nested > 0) {
      return nested;
    }
  }

  return null;
}

function findLineHintsFromLabels(sourceLines: string[], sourceLabel?: string, targetLabel?: string): number[] {
  const candidates = [sourceLabel, targetLabel]
    .map(normalizeLabel)
    .filter((value): value is string => value.length > 0 && value !== 'entry' && value !== 'exit');

  if (candidates.length === 0) {
    return [];
  }

  const hits = new Set<number>();
  sourceLines.forEach((line, idx) => {
    const normalized = normalizeLine(line);
    if (candidates.some(label => normalized.includes(label))) {
      hits.add(idx + 1);
    }
  });

  return Array.from(hits).sort((a, b) => a - b);
}

function normalizeLabel(value: string | undefined): string {
  if (!value) {
    return '';
  }
  return value.toLowerCase().replace(/[^a-z0-9_]+/g, ' ').trim();
}

function normalizeLine(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_]+/g, ' ');
}
