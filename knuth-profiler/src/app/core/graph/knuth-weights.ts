/**
 * Додела тежина гранама по Кнутовом алгоритму.
 *
 * w(e) = π(v), где је v одредишни чвор гране, а π(v) број путања од чвора v
 * до чвора EXIT у ацикличном погледу графа. Дефиниција је дата у теоријској
 * глави рада; овде се само спроводи.
 */
import { ENTRY_NODE_ID, EXIT_NODE_ID, isSentinelEdge } from './graph.constants';
import { GraphEdge, GraphNode } from './graph.types';

/**
 * Dodeljuje svakoj grani e=(u,v) tezinu w(e) = broj putanja od v do EXIT-a
 * u DAG pogledu grafa (Knutov algoritam, videti master rad, odeljak 2.3.1).
 */
export function assignKnuthWeights(nodes: GraphNode[], edges: GraphEdge[]): void {
  // Bira se po identitetu granicne grane, ne po vrsti: primeri iz kataloga
  // koriste kind 'entry'/'exit' i za stvarne grane uz ulaz i izlaz.
  const normalEdges = edges.filter(edge => !isSentinelEdge(edge));
  if (normalEdges.length === 0) {
    return;
  }

  const nodeIds = new Set(nodes.map(node => node.id));
  const outgoing = new Map<string, GraphEdge[]>();
  for (const nodeId of nodeIds) {
    outgoing.set(nodeId, []);
  }

  for (const edge of normalEdges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      continue;
    }
    outgoing.get(edge.source)?.push(edge);
  }

  const backEdgeIds = detectBackEdgeIds(nodeIds, outgoing);
  const acyclicOutgoing = new Map<string, GraphEdge[]>();
  for (const [nodeId, group] of outgoing.entries()) {
    acyclicOutgoing.set(nodeId, group.filter(edge => !backEdgeIds.has(edge.id)));
  }

  const topoOrder = buildTopologicalOrder(nodeIds, acyclicOutgoing);
  const pathCountByNode = computePathCounts(topoOrder, acyclicOutgoing);

  for (const edge of normalEdges) {
    edge.weight = pathCountByNode.get(edge.target) ?? 0;
  }
}

function detectBackEdgeIds(
  nodeIds: Set<string>,
  outgoing: Map<string, GraphEdge[]>
): Set<string> {
  const backEdgeIds = new Set<string>();
  const visitState = new Map<string, 0 | 1 | 2>();
  const sortedNodeIds = Array.from(nodeIds).sort((left, right) => left.localeCompare(right));

  const dfs = (nodeId: string): void => {
    visitState.set(nodeId, 1);

    for (const edge of outgoing.get(nodeId) ?? []) {
      const state = visitState.get(edge.target) ?? 0;
      if (state === 0) {
        dfs(edge.target);
      } else if (state === 1) {
        backEdgeIds.add(edge.id);
      }
    }

    visitState.set(nodeId, 2);
  };

  // Pretraga MORA da krene iz ENTRY-ja. Povratna grana je definisana preko
  // stabla pretrage zapocete iz ulaznog cvora; kad se krene odnekud drugde,
  // kao povratna se proglasi druga grana istog ciklusa. Kod petlje se tako
  // umesto grane koja zatvara ciklus obelezi grana koja ulazi u telo petlje.
  // Preostali cvorovi se obilaze posle, zbog uvezenih grafova koji umeju da
  // imaju delove nedostizne iz ENTRY-ja.
  const redosled = nodeIds.has(ENTRY_NODE_ID)
    ? [ENTRY_NODE_ID, ...sortedNodeIds.filter(id => id !== ENTRY_NODE_ID)]
    : sortedNodeIds;

  for (const nodeId of redosled) {
    if ((visitState.get(nodeId) ?? 0) === 0) {
      dfs(nodeId);
    }
  }

  return backEdgeIds;
}

function buildTopologicalOrder(
  nodeIds: Set<string>,
  outgoing: Map<string, GraphEdge[]>
): string[] {
  const visited = new Set<string>();
  const order: string[] = [];
  const sortedNodeIds = Array.from(nodeIds).sort((left, right) => left.localeCompare(right));

  const visit = (nodeId: string): void => {
    if (visited.has(nodeId)) {
      return;
    }

    visited.add(nodeId);
    for (const edge of outgoing.get(nodeId) ?? []) {
      visit(edge.target);
    }
    order.push(nodeId);
  };

  for (const nodeId of sortedNodeIds) {
    visit(nodeId);
  }

  return order.reverse();
}

/**
 * Broj putanja od svakog cvora do EXIT-a u DAG pogledu grafa:
 *
 *   pi(v) = 1                              ako je v = EXIT
 *   pi(v) = suma pi(w) po granama (v,w)    inace
 *
 * Cvor iz kog u DAG pogledu nema nijedne putanje do izlaza — telo petlje,
 * iz kog se izlazi jedino povratnom granom — ima pi(v) = 0. Nula nije
 * izuzetak koji treba zaobici: ona govori da je grana koja ulazi u telo
 * petlje strukturno najmanje znacajna, pa upravo ona treba da se meri.
 *
 * Obrnuti topoloski redosled garantuje da su svi naslednici izracunati pre
 * cvora, pa rekurzija ne treba pomocnu proveru dostiznosti.
 */
function computePathCounts(
  topoOrder: string[],
  outgoing: Map<string, GraphEdge[]>
): Map<string, number> {
  const pathCountByNode = new Map<string, number>();

  for (let index = topoOrder.length - 1; index >= 0; index -= 1) {
    const nodeId = topoOrder[index];

    if (nodeId === EXIT_NODE_ID) {
      pathCountByNode.set(nodeId, 1);
      continue;
    }

    const sum = (outgoing.get(nodeId) ?? [])
      .reduce((acc, edge) => acc + (pathCountByNode.get(edge.target) ?? 0), 0);
    pathCountByNode.set(nodeId, sum);
  }

  return pathCountByNode;
}
