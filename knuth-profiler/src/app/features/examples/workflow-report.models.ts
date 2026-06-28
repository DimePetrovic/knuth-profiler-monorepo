export interface WorkflowReportMetrics {
  nodeCount: number;
  edgeCount: number;
  instrumentedEdgeCount: number;
  instrumentedEdgePercent: number;
  instrumentedOps: number;
  fullInstrumentationOps: number;
  savedOps: number;
  savedOpsPercent: number;
}

export interface WorkflowReportCodeArtifact {
  filename: string;
  language: string;
  source: string;
}

export interface WorkflowInstrumentedEdgeRow {
  edgeId: string;
  sourceLabel: string;
  targetLabel: string;
  count: number;
}

export interface WorkflowNodeExecutionRow {
  nodeId: string;
  nodeLabel: string;
  executionCount: number;
  executionPercent: number;
}

export interface WorkflowReportSourceLine {
  lineNumber: number;
  text: string;
  highlighted: boolean;
  edgeIds: string[];
}
