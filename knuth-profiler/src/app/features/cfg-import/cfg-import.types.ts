import { GraphData } from '../../core/graph/graph.types';

export type CfgLanguage = 'c' | 'cpp' | 'java' | 'python' | 'javascript';

export interface CfgNodeJson {
  id: string;
  kind: 'entry' | 'exit' | 'stmt' | 'branch' | 'merge' | 'call' | 'return' | 'unknown';
  label: string;
  range: unknown;
}

export interface CfgEdgeJson {
  from: string;
  to: string;
  kind: 'next' | 'branch';
  label: string;
}

export interface CfgGraphJson {
  entryNodeId: string;
  exitNodeId: string;
  nodes: CfgNodeJson[];
  edges: CfgEdgeJson[];
}

export interface CfgResultJson {
  version: 'cfg-json-1';
  language: CfgLanguage;
  filename: string;
  sourceHash: string;
  graph: CfgGraphJson;
}

export interface CfgErrorJson {
  version: 'cfg-error-1';
  jobId: string;
  code: string;
  message: string;
  stage: string;
  details?: Record<string, unknown>;
}

export interface CfgJobStatus {
  jobId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  stage: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: CfgErrorJson | null;
}

export interface CfgImportViewState {
  jobId: string | null;
  status: CfgJobStatus | null;
  result: CfgResultJson | null;
  error: CfgErrorJson | null;
  graphData: GraphData | null;
}
