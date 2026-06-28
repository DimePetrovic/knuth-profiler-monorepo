import { Injectable, WritableSignal, computed, signal } from '@angular/core';
import { computeInstrumentedEdgeIds, computeMaxWeightSpanningTree } from '../../core/graph/graph-analysis';
import { ExampleItem, GraphData, GraphLayoutName, GraphOverlay, VizStep } from '../../core/graph/graph.types';
import { ExamplesCatalogService } from './examples-catalog.service';

@Injectable({ providedIn: 'root' })
export class ExamplesGraphStateService {
  // Core state
  readonly examples: ExampleItem[] = [];
  readonly selectedId: WritableSignal<string> = signal<string>("");
  readonly step = signal<VizStep>(0);
  readonly layout = signal<GraphLayoutName>('dagre');
  readonly importedGraphData = signal<GraphData | null>(null);

  // Derived
  readonly selectedExample = computed<ExampleItem | undefined>(() => this.examples.find(e => e.id === this.selectedId()));
  readonly graphData = computed<GraphData | null>(() => this.importedGraphData() ?? this.selectedExample()?.data ?? null);

  // MST and instrumentation
  readonly mstEdgeIds = computed<string[]>(() => {
    const gd = this.graphData();
    if (!gd) return [];
    return computeMaxWeightSpanningTree(gd);
  });

  // Simple rule: instrument all non-tree edges
  readonly instrumentedEdgeIds = computed<string[]>(() => {
    const gd = this.graphData();
    if (!gd) return [];
    return Array.from(new Set(computeInstrumentedEdgeIds(gd, this.mstEdgeIds())));
  });


  // Overlay per step
  readonly overlay = computed<GraphOverlay>(() => {
    const s = this.step();
    return {
      showWeights: s === 1,
      mstEdgeIds: s >= 2 ? this.mstEdgeIds() : [],
      instrumentedEdgeIds: s >= 3 ? this.instrumentedEdgeIds() : [],
      showEdgeIds: s >= 5
    };
  });

  constructor(private catalog: ExamplesCatalogService) {
    this.examples = this.catalog.list();
    this.selectedId = signal<string>(this.catalog.getDefault().id);
  }

  // Step controls
  start(): void { this.step.set(1); }     // Start -> Weights
  next(): void  { this.step.update(v => Math.min(6, (v + 1)) as VizStep); }
  prev(): void  { this.step.update(v => Math.max(0, (v - 1)) as VizStep); }
  reset(): void { this.step.set(0); }

  pickExample(id: string): void {
    this.importedGraphData.set(null);
    this.selectedId.set(id);
    this.reset();
  }

  setImportedGraph(graphData: GraphData): void {
    this.importedGraphData.set(graphData);
    this.reset();
  }

  clearImportedGraph(): void {
    this.importedGraphData.set(null);
    this.reset();
  }

  clearExampleSelection(): void {
    this.selectedId.set('');
    this.reset();
  }

  resetAllState(clearExampleSelection = false): void {
    this.importedGraphData.set(null);
    if (clearExampleSelection) {
      this.selectedId.set('');
    }
    this.layout.set('dagre');
    this.reset();
  }
}
