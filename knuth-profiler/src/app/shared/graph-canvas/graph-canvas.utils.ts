import { Core, ElementDefinition } from 'cytoscape';
import { GraphData, GraphOverlay } from '../../core/graph/graph.types';

const EMPTY_OVERLAY: GraphOverlay = {
  showWeights: false,
  mstEdgeIds: [],
  instrumentedEdgeIds: []
};

export function mapGraphToElements(graph: GraphData): ElementDefinition[] {
  const nodes: ElementDefinition[] = graph.nodes.map(node => ({
    data: {
      id: node.id,
      label: node.label ?? node.id,
      kind: node.kind ?? 'normal',
      ...(node.data ?? {})
    }
  }));

  const edges: ElementDefinition[] = graph.edges.map(edge => ({
    data: {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      kind: edge.kind ?? 'normal',
      label: edge.label ?? '',
      weight: edge.weight ?? null,
      _label: edge.label ?? ''
    }
  }));

  return [...nodes, ...edges];
}

export function replaceGraph(cy: Core, graph: GraphData): void {
  cy.elements().remove();
  cy.add(mapGraphToElements(graph));
}

export function applyGraphOverlay(cy: Core, overlay: GraphOverlay | null): void {
  const currentOverlay = overlay ?? EMPTY_OVERLAY;

  cy.nodes().removeClass('current');
  cy.edges().forEach(edge => {
    edge.removeClass('mst');
    edge.removeClass('instrumented');
    edge.removeClass('current');
    edge.data('_label', edge.data('label') || '');
  });

  if (currentOverlay.showWeights) {
    cy.edges().forEach(edge => {
      const weight = edge.data('weight');
      edge.data('_label', typeof weight === 'number' ? `(w=${weight})` : '');
    });
  }

  const mstEdgeIds = new Set(currentOverlay.mstEdgeIds ?? []);
  cy.edges().forEach(edge => {
    if (mstEdgeIds.has(edge.id())) {
      edge.addClass('mst');
    }
  });

  const instrumentedEdgeIds = new Set(currentOverlay.instrumentedEdgeIds ?? []);
  cy.edges().forEach(edge => {
    if (instrumentedEdgeIds.has(edge.id())) {
      edge.addClass('instrumented');
    }
  });

  const counters = currentOverlay.counters ?? {};
  const showIds = !!currentOverlay.showEdgeIds;

  cy.edges().forEach(edge => {
    const edgeId = edge.id();
    const baseLabel = edge.data('label') || '';
    const currentLabel = edge.data('_label') || '';
    const parts: string[] = [];

    if (showIds) {
      parts.push(`[${edgeId}]`);
    }

    if (!currentOverlay.showWeights && baseLabel && baseLabel !== currentLabel) {
      parts.push(baseLabel);
    }

    if (currentLabel && currentLabel !== baseLabel) {
      parts.push(currentLabel);
    }

    if (counters[edgeId] != null) {
      parts.push(`×${counters[edgeId]}`);
    }

    const finalLabel = parts.join(' ').trim();
    edge.data('_label', finalLabel || baseLabel);
  });

  if (currentOverlay.currentNodeId) {
    cy.getElementById(currentOverlay.currentNodeId).addClass('current');
  }

  if (currentOverlay.currentEdgeId) {
    cy.getElementById(currentOverlay.currentEdgeId).addClass('current');
  }
}