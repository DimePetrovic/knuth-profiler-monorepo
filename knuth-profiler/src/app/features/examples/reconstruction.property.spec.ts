/**
 * Svojstva rekonstrukcije brojaca nad nasumicno generisanim grafovima.
 *
 * Ovo je jezgro tvrdnje o ispravnosti: iz brojaca na malom skupu grana mora
 * se dobiti tacan broj prolazaka kroz SVE grane, ne samo kroz merene.
 *
 * Postupak je isti onaj koji izvodi `ReconstructionStateService`, samo bez
 * signala — pozivaju se iste ciste funkcije iz `reconstruction.helpers`.
 */

import { computeInstrumentedEdgeIds, computeMaxWeightSpanningTree } from '../../core/graph/graph-analysis';
import {
  ENTRY_NODE_ID,
  EXIT_NODE_ID,
  isSentinelEdge,
  isSentinelEdgeId,
} from '../../core/graph/graph.constants';
import { Counters, GraphData } from '../../core/graph/graph.types';
import { mulberry32 } from '../../core/graph/prng';
import {
  GeneratedGraph,
  GRAPH_CLASS_LABELS,
  generateCorpus,
  realEdges,
  realNodes,
} from '../../core/graph/random-graph.generator';
import { assignKnuthWeights } from '../cfg-import/cfg-import.adapter';
import {
  buildKnownCounts,
  ensureKnownZeroCounts,
  findSolvableNodeAndEdge,
  solveBalanceAtNode,
} from './reconstruction.helpers';
import { runFastSimulation } from './simulation.engine';

const SEME = 20260819;
const GRAFOVA = 150;
const POKRETANJA = 25;
// Petlje se napustaju sa verovatnocom najmanje 1/2 po prolazu, pa je ovo
// visestruko iznad ocekivane duzine; seme je fiksno, pa nema treperenja.
const MAX_KORAKA = 100000;

interface Ishod {
  stvarni: Counters;
  rekonstruisani: Counters;
  neresenih: number;
}

/** Rekonstrukcija do iscrpljenja, istim redosledom koji aplikacija koristi. */
function rekonstruisi(data: GraphData, T: readonly string[], S: readonly string[], mereni: Counters): { counters: Counters; neresenih: number } {
  const uStablu = new Set(T);
  const svePreostale = () =>
    realEdges(data)
      .filter(edge => uStablu.has(edge.id))
      .map(edge => edge.id);

  const rekonstruisani: Counters = {};

  for (;;) {
    const preostale = svePreostale().filter(id => !(id in rekonstruisani));
    if (preostale.length === 0) {
      break;
    }

    const poznati = ensureKnownZeroCounts(buildKnownCounts(mereni, rekonstruisani), S);
    const kandidat = findSolvableNodeAndEdge(data, preostale, poznati);
    if (!kandidat) {
      return { counters: { ...mereni, ...rekonstruisani }, neresenih: preostale.length };
    }

    const { x } = solveBalanceAtNode(data, kandidat.nodeId, kandidat.edge, poznati);
    rekonstruisani[kandidat.edge.id] = x;
  }

  return { counters: { ...mereni, ...rekonstruisani }, neresenih: 0 };
}

function izvrsi(g: GeneratedGraph): Ishod {
  const data = g.data;
  const T = computeMaxWeightSpanningTree(data);
  const S = computeInstrumentedEdgeIds(data, T);
  const config = { runs: POKRETANJA, maxStepsPerRun: MAX_KORAKA };

  // Isto seme daje istu putanju kroz graf; instrumentacija utice samo na to
  // koji se brojaci uvecavaju, ne i na izbor grane. Zato su ova dva
  // pokretanja ista simulacija, jednom merena svuda, jednom samo na S.
  const sveGrane = new Set(data.edges.map(edge => edge.id));
  const stvarni = runFastSimulation(data, sveGrane, config, mulberry32(SEME));
  const mereni = runFastSimulation(data, new Set(S), config, mulberry32(SEME));

  const { counters, neresenih } = rekonstruisi(data, T, S, mereni);
  return { stvarni, rekonstruisani: counters, neresenih };
}

function opis(g: GeneratedGraph, i: number): string {
  return `граф #${i} (${GRAPH_CLASS_LABELS[g.klasa]}, ${g.blokova} блока)`;
}

describe('Својства реконструкције бројача над насумичним графовима', () => {
  let korpus: GeneratedGraph[];
  let ishodi: Ishod[];

  beforeAll(() => {
    korpus = generateCorpus(SEME, GRAFOVA, mulberry32);
    for (const g of korpus) {
      assignKnuthWeights(g.data.nodes, g.data.edges);
    }
    ishodi = korpus.map(izvrsi);
  });

  it('свака грана стабла буде решена; ниједна не остаје', () => {
    korpus.forEach((g, i) => {
      expect(ishodi[i].neresenih).withContext(`${opis(g, i)}: нерешених грана`).toBe(0);
    });
  });

  // Svojstvo 4
  it('реконструисани бројачи једнаки стварнима на СВИМ гранама', () => {
    korpus.forEach((g, i) => {
      const { stvarni, rekonstruisani } = ishodi[i];

      for (const edge of realEdges(g.data)) {
        expect(rekonstruisani[edge.id] ?? 0)
          .withContext(`${opis(g, i)}: грана ${edge.id} (${edge.source}→${edge.target})`)
          .toBe(stvarni[edge.id] ?? 0);
      }
    });
  });

  it('мери се знатно мање грана него што их граф има', () => {
    korpus.forEach((g, i) => {
      const e = realEdges(g.data).length;
      const merenih = computeInstrumentedEdgeIds(
        g.data,
        computeMaxWeightSpanningTree(g.data)
      ).filter(id => !isSentinelEdgeId(id)).length;

      expect(merenih).withContext(`${opis(g, i)}: |S| наспрам e=${e}`).toBeLessThan(e);
    });
  });

  // Svojstvo 6
  it('проток се одржава у сваком чвору', () => {
    korpus.forEach((g, i) => {
      const { rekonstruisani } = ishodi[i];
      const grane = realEdges(g.data);
      const broj = (id: string) => rekonstruisani[id] ?? 0;

      for (const node of realNodes(g.data)) {
        const ulaz = grane.filter(edge => edge.target === node.id).reduce((s, edge) => s + broj(edge.id), 0);
        const izlaz = grane.filter(edge => edge.source === node.id).reduce((s, edge) => s + broj(edge.id), 0);

        if (node.id === ENTRY_NODE_ID) {
          expect(izlaz).withContext(`${opis(g, i)}: излаз из улазног чвора`).toBe(POKRETANJA);
        } else if (node.id === EXIT_NODE_ID) {
          expect(ulaz).withContext(`${opis(g, i)}: улаз у излазни чвор`).toBe(POKRETANJA);
        } else {
          expect(ulaz).withContext(`${opis(g, i)}: чвор ${node.id}, улаз наспрам излаза`).toBe(izlaz);
        }
      }
    });
  });

  it('гранична улазна грана броји покретања програма', () => {
    korpus.forEach((g, i) => {
      const granicna = g.data.edges.find(edge => isSentinelEdge(edge) && edge.target === ENTRY_NODE_ID);
      expect(ishodi[i].stvarni[granicna!.id]).withContext(opis(g, i)).toBe(POKRETANJA);
    });
  });
});
