import { Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import cytoscape, { Core } from 'cytoscape';
import { ensureCytoscapePluginsRegistered } from '../../core/graph/cytoscape-bootstrap';
import { GraphData, GraphLayoutName, GraphOverlay } from '../../core/graph/graph.types';
import { createGraphLayoutOptions, GRAPH_CANVAS_BASE_OPTIONS, GRAPH_CANVAS_STYLES } from './graph-canvas.config';
import { applyGraphOverlay, replaceGraph } from './graph-canvas.utils';

@Component({
  selector: 'app-graph-canvas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './graph-canvas.component.html'
})
export class GraphCanvasComponent implements OnInit, OnChanges, OnDestroy {
  @Input() data: GraphData | null = null;
  @Input() layoutName: GraphLayoutName = 'dagre';
  @Input() overlay: GraphOverlay | null = null;
  @Output() layoutNameChange = new EventEmitter<GraphLayoutName>();

  @ViewChild('cyHost', { static: true }) cyHost!: ElementRef<HTMLDivElement>;
  private cy?: Core;

  ngOnInit(): void {
    ensureCytoscapePluginsRegistered();

    this.cy = cytoscape({
      container: this.cyHost.nativeElement,
      elements: [],
      style: GRAPH_CANVAS_STYLES as any,
      layout: { name: 'dagre' },
      ...GRAPH_CANVAS_BASE_OPTIONS
    });

    if (this.data) {
      this.setGraph(this.data);
      this.applyOverlay();
      this.runLayout();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.cy) return;
    if (changes['data'] && this.data) {
      this.setGraph(this.data);
      this.applyOverlay();
      this.runLayout();
    }
    if (changes['overlay']) {
      this.applyOverlay();
    }
    if (changes['layoutName']) {
      this.runLayout();
    }
  }

  ngOnDestroy(): void { this.cy?.destroy(); }

  fit(): void { this.cy?.fit(undefined, 20); }
  relayout(): void { this.runLayout(); }

  onLayoutChange(rawValue: string): void {
    if (rawValue !== 'dagre' && rawValue !== 'elk') {
      return;
    }

    const nextLayout = rawValue as GraphLayoutName;
    if (nextLayout === this.layoutName) {
      return;
    }

    this.layoutNameChange.emit(nextLayout);
  }

  // --- Internals ------------------------------------------------------------

  private setGraph(graph: GraphData): void {
    replaceGraph(this.cy!, graph);
  }

  private applyOverlay(): void {
    if (!this.cy) return;
    applyGraphOverlay(this.cy, this.overlay);
  }

  private runLayout(): void {
    if (!this.cy) return;
    this.cy.layout(createGraphLayoutOptions(this.layoutName) as any).run();
    this.fit();
  }
}
