/**
 * Generator nasumičnih grafova kontrole toka za evaluaciju.
 *
 * Graf se sastavlja od segmenata sa tačno jednim ulazom i tačno jednim
 * izlazom, pa je nizanje segmenata dovoljno da graf ostane strukturno
 * ispravan. Oblici segmenata su isti oni koje `ExamplesCatalogService` ima
 * ručno napisane, samo parametrizovani veličinom.
 *
 * Grane dobijaju `kind: 'normal'`, kao kod uvezenih grafova; granične grane
 * se prepoznaju isključivo po identifikatoru (`isSentinelEdge`).
 */

import {
  ENTRY_NODE_ID,
  ENTRY_SENTINEL_ID,
  EXIT_NODE_ID,
  EXIT_SENTINEL_ID,
  GHOST_IN_NODE_ID,
  GHOST_OUT_NODE_ID,
  isSentinelEdge,
} from './graph.constants';
import { GraphData, GraphEdge, GraphNode, NodeKind } from './graph.types';
import { randomInt, randomOf } from './prng';

export type GraphClass =
  | 'linearni'
  | 'grananje'
  | 'petlja'
  | 'ugnjezdena-petlja'
  | 'vise-ishoda'
  | 'mesoviti';

export const GRAPH_CLASSES: readonly GraphClass[] = [
  'linearni',
  'grananje',
  'petlja',
  'ugnjezdena-petlja',
  'vise-ishoda',
  'mesoviti',
];

/** Srpski naziv klase, onakav kakav ulazi u tabelu u radu. */
export const GRAPH_CLASS_LABELS: Readonly<Record<GraphClass, string>> = {
  linearni: 'линеарни ток',
  grananje: 'гранање',
  petlja: 'петља',
  'ugnjezdena-petlja': 'угњеждена петља',
  'vise-ishoda': 'више исхода',
  mesoviti: 'мешовити',
};

class Builder {
  readonly nodes: GraphNode[] = [];
  readonly edges: GraphEdge[] = [];
  private nodeSeq = 0;
  private edgeSeq = 0;

  constructor() {
    this.nodes.push({ id: ENTRY_NODE_ID, label: 'ENTRY', kind: 'entry' });
  }

  node(kind: NodeKind = 'normal'): string {
    // Prefiks 'b' (blok) sortira se PRE 'ENTRY' po localeCompare. Namerno:
    // tako korpus izlaze pretragu u dubinu koja ne krece iz ulaznog cvora,
    // sto je greska koju katalog primera (cvorovi B, D) ume da izazove.
    const id = `b${this.nodeSeq++}`;
    this.nodes.push({ id, label: id, kind });
    return id;
  }

  edge(source: string, target: string, label = '', povratna = false): void {
    // Identifikator je poravnat na istu širinu jer Kruskal razrešava jednake
    // težine poređenjem niski; bez poravnanja bi "e10" došlo pre "e9".
    const id = `e${String(this.edgeSeq++).padStart(4, '0')}`;
    // `povratna` je istina po konstrukciji, a ne rezultat detekcije. Zato se
    // njome može proveriti da li aplikacija povratne grane prepoznaje tačno.
    this.edges.push({ id, source, target, label, kind: 'normal', weight: 0, data: { povratna } });
  }
}

type Segment = (b: Builder, entry: string, rng: () => number) => string;

const segNaredba: Segment = (b, entry) => {
  const v = b.node();
  b.edge(entry, v);
  return v;
};

const segAkoInace: Segment = (b, entry) => {
  const d = b.node('decision');
  b.edge(entry, d);
  const t = b.node();
  const f = b.node();
  const m = b.node();
  b.edge(d, t, 'да');
  b.edge(d, f, 'не');
  b.edge(t, m);
  b.edge(f, m);
  return m;
};

const segAko: Segment = (b, entry) => {
  const d = b.node('decision');
  b.edge(entry, d);
  const t = b.node();
  const m = b.node();
  b.edge(d, t, 'да');
  b.edge(d, m, 'не');
  b.edge(t, m);
  return m;
};

const segPetlja: Segment = (b, entry) => {
  const d = b.node('decision');
  b.edge(entry, d);
  const telo = b.node();
  b.edge(d, telo, 'да');
  b.edge(telo, d, '', true); // povratna grana
  const m = b.node();
  b.edge(d, m, 'не');
  return m;
};

const segUgnjezdenaPetlja: Segment = (b, entry) => {
  const spolja = b.node('decision');
  b.edge(entry, spolja);
  const unutra = b.node('decision');
  b.edge(spolja, unutra, 'да');
  const telo = b.node();
  b.edge(unutra, telo, 'да');
  b.edge(telo, unutra, '', true); // unutrašnja povratna grana
  b.edge(unutra, spolja, 'не', true); // spoljašnja povratna grana
  const m = b.node();
  b.edge(spolja, m, 'не');
  return m;
};

const segViseIshoda: Segment = (b, entry, rng) => {
  const d = b.node('decision');
  b.edge(entry, d);
  const m = b.node();
  const grana = randomInt(rng, 3, 5);
  for (let i = 0; i < grana; i++) {
    const bi = b.node();
    b.edge(d, bi, i === grana - 1 ? 'иначе' : `=${i}`);
    b.edge(bi, m);
  }
  return m;
};

const segPetljaSaGrananjem: Segment = (b, entry) => {
  const d = b.node('decision');
  b.edge(entry, d);
  const telo = b.node();
  b.edge(d, telo, 'да');
  const di = b.node('decision');
  b.edge(telo, di);
  const t = b.node();
  const f = b.node();
  b.edge(di, t, 'да');
  b.edge(di, f, 'не');
  b.edge(t, d, '', true); // povratna grana
  b.edge(f, d, '', true); // povratna grana
  const m = b.node();
  b.edge(d, m, 'не');
  return m;
};

const SEGMENTI_PO_KLASI: Readonly<Record<GraphClass, readonly Segment[]>> = {
  linearni: [segNaredba],
  grananje: [segAkoInace, segAko],
  petlja: [segPetlja],
  'ugnjezdena-petlja': [segUgnjezdenaPetlja],
  'vise-ishoda': [segViseIshoda],
  mesoviti: [
    segNaredba,
    segAkoInace,
    segAko,
    segPetlja,
    segUgnjezdenaPetlja,
    segViseIshoda,
    segPetljaSaGrananjem,
  ],
};

/**
 * Sastavlja graf date klase od `blokova` segmenata, pa dodaje granične
 * grane onako kako ih aplikacija očekuje. Težine se NE dodeljuju ovde —
 * to radi sama aplikacija, da bi merenje merilo nju, a ne generator.
 */
export function generateGraph(klasa: GraphClass, blokova: number, rng: () => number): GraphData {
  const b = new Builder();
  const segmenti = SEGMENTI_PO_KLASI[klasa];

  let cur = ENTRY_NODE_ID;
  for (let i = 0; i < blokova; i++) {
    cur = randomOf(rng, segmenti)(b, cur, rng);
  }

  b.nodes.push({ id: EXIT_NODE_ID, label: 'EXIT', kind: 'exit' });
  b.edge(cur, EXIT_NODE_ID);

  b.nodes.push({ id: GHOST_IN_NODE_ID, label: '', kind: 'normal', data: { ghost: true } });
  b.nodes.push({ id: GHOST_OUT_NODE_ID, label: '', kind: 'ghost_out', data: { ghost: true } });
  b.edges.push({
    id: ENTRY_SENTINEL_ID,
    source: GHOST_IN_NODE_ID,
    target: ENTRY_NODE_ID,
    label: '',
    kind: 'entry',
    weight: 0,
  });
  b.edges.push({
    id: EXIT_SENTINEL_ID,
    source: EXIT_NODE_ID,
    target: GHOST_OUT_NODE_ID,
    label: '',
    kind: 'exit',
    weight: 0,
  });

  return { nodes: b.nodes, edges: b.edges };
}

export interface GeneratedGraph {
  klasa: GraphClass;
  blokova: number;
  data: GraphData;
}

/**
 * Skup grafova ravnomerno raspoređen po klasama i veličinama. Isto seme daje
 * isti skup, pa se svaki broj iz evaluacije može ponoviti.
 */
export function generateCorpus(
  seme: number,
  koliko: number,
  rngFabrika: (s: number) => () => number,
  maxBlokova = 6
): GeneratedGraph[] {
  const rng = rngFabrika(seme);
  const korpus: GeneratedGraph[] = [];

  for (let i = 0; i < koliko; i++) {
    const klasa = GRAPH_CLASSES[i % GRAPH_CLASSES.length];
    const blokova = randomInt(rng, 1, maxBlokova);
    korpus.push({ klasa, blokova, data: generateGraph(klasa, blokova, rng) });
  }

  return korpus;
}

// --- Merenje bez granicnih grana i pomocnih cvorova -------------------------

const POMOCNI_CVOROVI: ReadonlySet<string> = new Set([GHOST_IN_NODE_ID, GHOST_OUT_NODE_ID]);

/** Čvorovi koji ulaze u broj $n$ iz dokaza optimalnosti. */
export function realNodes(data: GraphData): GraphNode[] {
  return data.nodes.filter(node => !POMOCNI_CVOROVI.has(node.id));
}

/** Grane koje ulaze u broj $e$ iz dokaza optimalnosti. */
export function realEdges(data: GraphData): GraphEdge[] {
  return data.edges.filter(edge => !isSentinelEdge(edge));
}

// --- Provera strukturne ispravnosti -----------------------------------------

/**
 * Vraća spisak prekršenih invarijanti; prazan niz znači ispravan graf.
 * Bez ovoga merenje ne znači ništa: neispravan graf daje broj koji se ne
 * odnosi ni na šta.
 */
export function structuralViolations(data: GraphData): string[] {
  const greske: string[] = [];
  const cvorovi = new Set(realNodes(data).map(node => node.id));
  const grane = realEdges(data);

  if (!cvorovi.has(ENTRY_NODE_ID)) {
    greske.push('нема улазног чвора');
  }
  if (!cvorovi.has(EXIT_NODE_ID)) {
    greske.push('нема излазног чвора');
  }
  if (grane.some(edge => !cvorovi.has(edge.source) || !cvorovi.has(edge.target))) {
    greske.push('грана води ван скупа чворова');
  }
  if (grane.some(edge => edge.target === ENTRY_NODE_ID)) {
    greske.push('улазни чвор има улазну грану');
  }
  if (grane.some(edge => edge.source === EXIT_NODE_ID)) {
    greske.push('излазни чвор има излазну грану');
  }

  const napred = new Map<string, string[]>();
  const nazad = new Map<string, string[]>();
  for (const id of cvorovi) {
    napred.set(id, []);
    nazad.set(id, []);
  }
  for (const edge of grane) {
    napred.get(edge.source)?.push(edge.target);
    nazad.get(edge.target)?.push(edge.source);
  }

  const izEntry = dostizni(ENTRY_NODE_ID, napred);
  if (izEntry.size !== cvorovi.size) {
    greske.push('постоји чвор недостижан из улаза');
  }

  const doExit = dostizni(EXIT_NODE_ID, nazad);
  if (doExit.size !== cvorovi.size) {
    greske.push('постоји чвор из ког се не стиже до излаза');
  }

  const graniceIds = data.edges.filter(edge => isSentinelEdge(edge)).map(edge => edge.id);
  if (!graniceIds.includes(ENTRY_SENTINEL_ID) || !graniceIds.includes(EXIT_SENTINEL_ID)) {
    greske.push('недостаје гранична грана');
  }
  if (graniceIds.length !== 2) {
    greske.push('погрешан број граничних грана');
  }

  return greske;
}

function dostizni(od: string, susedi: ReadonlyMap<string, string[]>): Set<string> {
  const vidjeni = new Set<string>([od]);
  const stek = [od];

  while (stek.length > 0) {
    const cur = stek.pop()!;
    for (const next of susedi.get(cur) ?? []) {
      if (!vidjeni.has(next)) {
        vidjeni.add(next);
        stek.push(next);
      }
    }
  }

  return vidjeni;
}
