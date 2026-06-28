// Basic node kinds for readability and styling.
export type NodeKind = 'entry' | 'exit' | 'normal' | 'decision' | 'ghost_out';

// Edge classification; 'entry'/'exit' represent sentinel edges.
export type EdgeKind = 'normal' | 'entry' | 'exit' | 'back' | 'chord';

// Minimal node shape for Cytoscape input.
export interface GraphNode {
  id: string;                    // unique node id
  label?: string;                // display label
  kind?: NodeKind;               // semantic kind (styling, logic)
  data?: Record<string, unknown>;// custom metadata
}

// Minimal edge shape for Cytoscape input.
export interface GraphEdge {
  id: string;                    // unique edge id
  source: string;                // source node id
  target: string;                // target node id
  label?: string;                // display label (e.g. true/false)
  kind?: EdgeKind;               // semantic kind (e.g. 'chord')
  instrumented?: boolean;        // marked for counting
  weight?: number;
  data?: Record<string, unknown>;// custom metadata
}

export type VizStep = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0:Start, 1:Weights, 2:MST, 3:Instr, 4:Measure, 5:Reconstruct, 6:Report

// Add counters and simulation overlay bits
export interface Counters {
  [edgeId: string]: number;
}

// Overlay model consumed by GraphCanvas
export interface GraphOverlay {
  showWeights: boolean;
  mstEdgeIds: string[];          // edges highlighted as MST
  instrumentedEdgeIds: string[]; // edges marked for instrumentation

  // Simulation overlay
  counters?: Counters;               // edgeId -> count (instrumented only)
  currentNodeId?: string | null;     // highlight current node
  currentEdgeId?: string | null;     // highlight current edge

  showEdgeIds?: boolean;
}

// Simulation config
export interface SimulationConfig {
  runs: number;            // e.g. 20
  maxStepsPerRun: number;  // e.g. 200
  speed?: number;          // animation speed multiplier (0.25 - 3), default 1
  fastMode?: boolean;      // if true, run without animation
}

// Graph container (nodes + edges).
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Example catalog item (for the Examples page).
export interface ExampleItem {
  id: string;                    // stable slug (e.g. 'linear-flow')
  title: string;                 // UI title (Serbian in UI layer)
  description: string;           // short description (Serbian in UI layer)
  data: GraphData;               // actual graph content
}

// Supported layouts for our viewer.
export type GraphLayoutName = 'dagre' | 'elk';

// Minimal layout options (extensible per engine).
export interface GraphLayoutOptions {
  name: GraphLayoutName;
  fit?: boolean;                 // auto-fit after layout
  padding?: number;              // fit padding
  // Engine-specific options (kept loose due to missing typings).
  dagre?: Record<string, unknown>;
  elk?: Record<string, unknown>;
}

// Optional: basic profiling result shape (future use).
export interface EdgeCount {
  edgeId: string;
  count: number;
}

export interface ProfilingResult {
  edgeCounts: EdgeCount[];
  computedAt: string;            // ISO date string
}

// Reconstruction term for explanation panel
export interface ReconTerm {
  edgeId: string;
  sign: 1 | -1;          // + incoming contribution, - outgoing (relative to node balance)
  value: number;         // known count used in formula
  label?: string;        // optional human label
}

// One reconstruction step (solved tree edge)
export interface ReconStep {
  solvedEdgeId: string;  // tree edge that got its count
  value: number;         // computed count
  nodeId: string;        // node where balance was applied
  parentId: string;      // its parent in the MST
  equation: ReconTerm[]; // explanation terms used for x
  text?: string;         // pre-rendered textual explanation (optional)
}

// Lightweight runtime guards (useful for API/file imports).
export function isGraphNode(v: unknown): v is GraphNode {
  return !!v && typeof v === 'object' && 'id' in (v as any) && typeof (v as any).id === 'string';
}

export function isGraphEdge(v: unknown): v is GraphEdge {
  const obj = v as any;
  return !!obj && typeof obj === 'object'
    && typeof obj.id === 'string'
    && typeof obj.source === 'string'
    && typeof obj.target === 'string';
}

export function isGraphData(v: unknown): v is GraphData {
  const obj = v as any;
  return !!obj && Array.isArray(obj.nodes) && Array.isArray(obj.edges)
    && obj.nodes.every(isGraphNode) && obj.edges.every(isGraphEdge);
}

