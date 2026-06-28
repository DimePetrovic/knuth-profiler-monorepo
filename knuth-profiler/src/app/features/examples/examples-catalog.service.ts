import { Injectable } from '@angular/core';
import {
  ENTRY_NODE_ID,
  ENTRY_SENTINEL_ID,
  EXIT_NODE_ID,
  EXIT_SENTINEL_ID,
  GHOST_IN_NODE_ID,
  GHOST_OUT_NODE_ID
} from '../../core/graph/graph.constants';
import { ExampleItem, GraphData } from '../../core/graph/graph.types';

@Injectable({ providedIn: 'root' })
export class ExamplesCatalogService {

  list(): ExampleItem[] {
    const items = [
      this.linearFlow(),
      this.ifElse(),
      this.whileLoop(),
      this.nestedLoop(),
      this.switchThree(),
      this.loopWithIf()
    ];
    // Bake sentinels once for all items
    return items.map(it => ({ ...it, data: this.ensureSentinels(it.data) }));
  }

  getDefault(): ExampleItem {
    return this.list()[0];
  }

  // --- Helpers --------------------------------------------------------------

  private ensureSentinels(data: GraphData): GraphData {
    const nodes = [...data.nodes];
    const edges = [...data.edges];

    const hasEntry = nodes.some(n => n.id === ENTRY_NODE_ID);
    const hasExit  = nodes.some(n => n.id === EXIT_NODE_ID);
    if (!hasEntry || !hasExit) return { nodes, edges };

    if (!nodes.some(n => n.id === GHOST_IN_NODE_ID)) nodes.push({ id: GHOST_IN_NODE_ID, label: '', kind: 'normal', data: { ghost: true } });
    if (!nodes.some(n => n.id === GHOST_OUT_NODE_ID)) nodes.push({ id: GHOST_OUT_NODE_ID, label: '', kind: 'normal', data: { ghost: true } });

    if (!edges.some(e => e.source === GHOST_IN_NODE_ID && e.target === ENTRY_NODE_ID && e.kind === 'entry'))
      edges.push({ id: ENTRY_SENTINEL_ID, source: GHOST_IN_NODE_ID, target: ENTRY_NODE_ID, label: '', kind: 'entry', weight: 0 });

    if (!edges.some(e => e.source === EXIT_NODE_ID && e.target === GHOST_OUT_NODE_ID && e.kind === 'exit'))
      edges.push({ id: EXIT_SENTINEL_ID, source: EXIT_NODE_ID, target: GHOST_OUT_NODE_ID, label: '', kind: 'exit', weight: 0 });

    return { nodes, edges };
  }

  private n(id: string, label: string, kind: GraphData['nodes'][number]['kind'] = 'normal') {
    return { id, label, kind };
  }
  private e(id: string, source: string, target: string, label: string | undefined, weight: number, kind: GraphData['edges'][number]['kind'] = 'normal') {
    return { id, source, target, label, weight, kind };
  }

  // --- Examples -------------------------------------------------------------

  // 1) Linear flow
  private linearFlow(): ExampleItem {
    const data: GraphData = {
      nodes: [
        this.n('ENTRY', 'ENTRY', 'entry'),
        this.n('A', 'A'),
        this.n('B', 'B'),
        this.n('C', 'C'),
        this.n('EXIT', 'EXIT', 'exit')
      ],
      edges: [
        this.e('e0', 'ENTRY', 'A', '', 1, 'entry'),
        this.e('e1', 'A', 'B', '', 1),
        this.e('e2', 'B', 'C', '', 1),
        this.e('e3', 'C', 'EXIT', '', 1, 'exit')
      ]
    };
    return { id: 'linear-flow', title: 'Линеарни ток', description: 'Најједноставнији пример без гранања.', data };
  }

  // 2) If / Else
  private ifElse(): ExampleItem {
    const data: GraphData = {
      nodes: [
        this.n('ENTRY', 'ENTRY', 'entry'),
        this.n('S', 'S'),
        this.n('D', 'D', 'decision'),
        this.n('T', 'T'),
        this.n('F', 'F'),
        this.n('M', 'M'),
        this.n('EXIT', 'EXIT', 'exit')
      ],
      edges: [
        this.e('e0', 'ENTRY', 'S', '', 1, 'entry'),
        this.e('e1', 'S', 'D', '', 1),
        this.e('e2', 'D', 'T', 'true', 1),
        this.e('e3', 'D', 'F', 'false', 2),
        this.e('e4', 'T', 'M', '', 1),
        this.e('e5', 'F', 'M', '', 1),
        this.e('e6', 'M', 'EXIT', '', 1, 'exit')
      ]
    };
    return { id: 'if-else', title: 'Ако / Иначе', description: 'Гранање са спајањем путања.', data };
  }

  // 3) While loop
  private whileLoop(): ExampleItem {
    const data: GraphData = {
      nodes: [
        this.n('ENTRY', 'ENTRY', 'entry'),
        this.n('I', 'I'),
        this.n('D', 'D', 'decision'),
        this.n('B', 'B'),
        this.n('EXIT', 'EXIT', 'exit')
      ],
      edges: [
        this.e('e0', 'ENTRY', 'I', '', 1, 'entry'),
        this.e('e1', 'I', 'D', '', 1),
        this.e('e2', 'D', 'B', 'true', 1),
        this.e('e3', 'B', 'D', '', 1),   // back
        this.e('e4', 'D', 'EXIT', 'false', 1, 'exit')
      ]
    };
    return { id: 'while-loop', title: 'Једноставна петља', description: 'While-петља са повратном ивицом.', data };
  }

  // 4) Nested loop
  private nestedLoop(): ExampleItem {
    const data: GraphData = {
      nodes: [
        this.n('ENTRY', 'ENTRY', 'entry'),
        this.n('P', 'P'),
        this.n('D1', 'D1', 'decision'),
        this.n('D2', 'D2', 'decision'),
        this.n('B', 'B'),
        this.n('EXIT', 'EXIT', 'exit')
      ],
      edges: [
        this.e('e0', 'ENTRY', 'P', '', 1, 'entry'),
        this.e('e1', 'P', 'D1', '', 1),
        this.e('e2', 'D1', 'D2', 'true', 1),
        this.e('e3', 'D2', 'B', 'true', 1),
        this.e('e4', 'B', 'D2', '', 1),  // inner back
        this.e('e5', 'D2', 'D1', 'false', 1),
        this.e('e6', 'D1', 'EXIT', 'false', 1, 'exit')
      ]
    };
    return { id: 'nested-loop', title: 'Угњеждена петља', description: 'Две петље: унутрашња у спољашњој.', data };
  }

  // 5) Switch / 3 outcomes
  private switchThree(): ExampleItem {
    const data: GraphData = {
      nodes: [
        this.n('ENTRY', 'ENTRY', 'entry'),
        this.n('D', 'D', 'decision'),
        this.n('B0', 'B0 = 0'),
        this.n('B1', 'B1 = 1'),
        this.n('B2', 'B2'),
        this.n('M', 'M'),
        this.n('EXIT', 'EXIT', 'exit')
      ],
      edges: [
        this.e('e0', 'ENTRY', 'D', '', 1, 'entry'),
        this.e('e1', 'D', 'B0', '=0', 1),
        this.e('e2', 'D', 'B1', '=1', 2),
        this.e('e3', 'D', 'B2', 'else', 3),
        this.e('e4', 'B0', 'M', '', 1),
        this.e('e5', 'B1', 'M', '', 1),
        this.e('e6', 'B2', 'M', '', 1),
        this.e('e7', 'M', 'EXIT', '', 1, 'exit')
      ]
    };
    return { id: 'switch-three', title: 'Више исхода', description: 'Гранање са три излаза и спајањем.', data };
  }

  // 6) Loop with inner if
  private loopWithIf(): ExampleItem {
    const data: GraphData = {
      nodes: [
        this.n('ENTRY', 'ENTRY', 'entry'),
        this.n('Dloop', 'Dloop', 'decision'),
        this.n('Body', 'Body'),
        this.n('Dif', 'Dif', 'decision'),
        this.n('T', 'T'),
        this.n('F', 'F'),
        this.n('EXIT', 'EXIT', 'exit')
      ],
      edges: [
        this.e('e0', 'ENTRY', 'Dloop', '', 1, 'entry'),
        this.e('e1', 'Dloop', 'Body', 'true', 1),
        this.e('e2', 'Body', 'Dif', '', 1),
        this.e('e3', 'Dif', 'T', 'true', 1),
        this.e('e4', 'Dif', 'F', 'false', 2),
        this.e('e5', 'T', 'Dloop', '', 1),
        this.e('e6', 'F', 'Dloop', '', 1),
        this.e('e7', 'Dloop', 'EXIT', 'false', 1, 'exit')
      ]
    };
    return { id: 'loop-if', title: 'Петља + if', description: 'If-else унутар петље.', data };
  }
}
