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
import { assignKnuthWeights } from '../../core/graph/knuth-weights';

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
    // Granicne grane i tezine se racunaju jednom, za sve primere. Tezine se
    // NE upisuju rucno: w(e) = pi(v) je definicija iz rada, pa se i za
    // ugradjene primere dobija istim postupkom kao i za uvezene grafove.
    return items.map(it => {
      const data = this.ensureSentinels(it.data);
      assignKnuthWeights(data.nodes, data.edges);
      return { ...it, data };
    });
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
  // Tezina se ne prosledjuje: racuna je assignKnuthWeights u list().
  private e(id: string, source: string, target: string, label: string | undefined, kind: GraphData['edges'][number]['kind'] = 'normal') {
    return { id, source, target, label, weight: 0, kind };
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
        this.e('e0', 'ENTRY', 'A', '', 'entry'),
        this.e('e1', 'A', 'B', ''),
        this.e('e2', 'B', 'C', ''),
        this.e('e3', 'C', 'EXIT', '', 'exit')
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
        this.e('e0', 'ENTRY', 'S', '', 'entry'),
        this.e('e1', 'S', 'D', ''),
        this.e('e2', 'D', 'T', 'да'),
        this.e('e3', 'D', 'F', 'не'),
        this.e('e4', 'T', 'M', ''),
        this.e('e5', 'F', 'M', ''),
        this.e('e6', 'M', 'EXIT', '', 'exit')
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
        this.e('e0', 'ENTRY', 'I', '', 'entry'),
        this.e('e1', 'I', 'D', ''),
        this.e('e2', 'D', 'B', 'да'),
        this.e('e3', 'B', 'D', ''),   // back
        this.e('e4', 'D', 'EXIT', 'не', 'exit')
      ]
    };
    return { id: 'while-loop', title: 'Једноставна петља', description: 'Петља са повратном граном.', data };
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
        this.e('e0', 'ENTRY', 'P', '', 'entry'),
        this.e('e1', 'P', 'D1', ''),
        this.e('e2', 'D1', 'D2', 'да'),
        this.e('e3', 'D2', 'B', 'да'),
        this.e('e4', 'B', 'D2', ''),  // inner back
        this.e('e5', 'D2', 'D1', 'не'),
        this.e('e6', 'D1', 'EXIT', 'не', 'exit')
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
        this.e('e0', 'ENTRY', 'D', '', 'entry'),
        this.e('e1', 'D', 'B0', '=0'),
        this.e('e2', 'D', 'B1', '=1'),
        this.e('e3', 'D', 'B2', 'иначе'),
        this.e('e4', 'B0', 'M', ''),
        this.e('e5', 'B1', 'M', ''),
        this.e('e6', 'B2', 'M', ''),
        this.e('e7', 'M', 'EXIT', '', 'exit')
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
        this.e('e0', 'ENTRY', 'Dloop', '', 'entry'),
        this.e('e1', 'Dloop', 'Body', 'да'),
        this.e('e2', 'Body', 'Dif', ''),
        this.e('e3', 'Dif', 'T', 'да'),
        this.e('e4', 'Dif', 'F', 'не'),
        this.e('e5', 'T', 'Dloop', ''),
        this.e('e6', 'F', 'Dloop', ''),
        this.e('e7', 'Dloop', 'EXIT', 'не', 'exit')
      ]
    };
    return { id: 'loop-if', title: 'Петља са гранањем', description: 'Гранање унутар петље.', data };
  }
}
