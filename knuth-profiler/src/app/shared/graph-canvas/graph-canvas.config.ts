import { GraphLayoutName } from '../../core/graph/graph.types';

const COLORS = {
  dark: '#1f2937',
  darkMuted: '#111827',
  edge: '#6b7280',
  entry: '#22c55e',
  exit: '#ef4444',
  decision: '#0ea5e9',
  current: '#7c3aed',
  selected: '#f59e0b',
  surface: '#ffffff'
} as const;

export const GRAPH_CANVAS_STYLES = [
  { selector: 'node[ghost]', style: { opacity: 0, width: 1, height: 1, events: 'no' } },
  { selector: 'node[kind = "entry"]', style: { shape: 'round-rectangle', 'background-color': COLORS.entry, label: 'data(label)', color: COLORS.darkMuted } },
  { selector: 'node[kind = "exit"]', style: { shape: 'round-rectangle', 'background-color': COLORS.exit, label: 'data(label)', color: COLORS.darkMuted } },
  { selector: 'node[kind = "decision"]', style: { shape: 'diamond', 'background-color': COLORS.decision, label: 'data(label)', color: COLORS.darkMuted } },
  {
    selector: 'node',
    style: {
      'background-color': COLORS.dark,
      label: 'data(label)',
      color: COLORS.dark,
      'text-valign': 'center',
      'text-halign': 'center',
      'font-size': 13,
      'font-weight': 'bold',
      'text-outline-width': 1,
      'text-outline-color': COLORS.surface,
      'text-background-color': COLORS.surface,
      'text-background-opacity': 0.8,
      'text-background-shape': 'roundrectangle',
      'text-background-padding': '2'
    }
  },
  { selector: 'edge[kind = "entry"]', style: { 'line-color': COLORS.entry, 'target-arrow-color': COLORS.entry } },
  { selector: 'edge[kind = "exit"]', style: { 'line-color': COLORS.exit, 'target-arrow-color': COLORS.exit } },
  {
    selector: 'edge',
    style: {
      'curve-style': 'bezier',
      width: 2,
      'line-color': COLORS.edge,
      'target-arrow-shape': 'triangle',
      'target-arrow-color': COLORS.edge,
      label: 'data(_label)',
      'font-size': 14,
      'font-weight': 'bold',
      color: COLORS.dark,
      'text-background-color': COLORS.surface,
      'text-background-opacity': 0.9,
      'text-background-shape': 'roundrectangle',
      'text-background-padding': '2'
    }
  },
  { selector: 'edge.mst', style: { width: 5, 'line-color': COLORS.darkMuted, 'target-arrow-color': COLORS.darkMuted } },
  { selector: 'edge.instrumented', style: { 'line-style': 'dashed' } },
  { selector: 'edge.current', style: { 'line-color': COLORS.current, 'target-arrow-color': COLORS.current, width: 6 } },
  { selector: 'node.current', style: { 'border-width': 4, 'border-color': COLORS.current } },
  { selector: ':selected', style: { 'border-width': 3, 'border-color': COLORS.selected } }
];

export const GRAPH_CANVAS_BASE_OPTIONS = {
  pixelRatio: 1
} as const;

export function createGraphLayoutOptions(layoutName: GraphLayoutName): Record<string, unknown> {
  if (layoutName === 'elk') {
    return {
      name: 'elk',
      fit: true,
      elk: {
        algorithm: 'layered',
        'elk.direction': 'DOWN',
        'elk.layered.spacing.nodeNodeBetweenLayers': 40
      }
    };
  }

  return {
    name: 'dagre',
    fit: true,
    nodeSep: 30,
    rankSep: 60,
    rankDir: 'TB'
  };
}