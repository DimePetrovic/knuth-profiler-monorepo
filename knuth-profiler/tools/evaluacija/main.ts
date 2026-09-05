/**
 * Merenje Knutovog algoritma nad velikim skupom nasumicnih grafova.
 *
 * Nije test nego alatka: property testovi tvrde da je algoritam ispravan,
 * ovo meri koliko on stedi. Pokretanje:
 *
 *   npx tsc -p tsconfig.tools.json && node .tools-out/tools/evaluacija/main.js > rezultati.json
 *
 * Isto seme daje isti rezultat, pa se svaki broj iz rada moze ponoviti.
 */

import {
  computeInstrumentedEdgeIds,
  computeMaxWeightSpanningTree,
} from '../../src/app/core/graph/graph-analysis';
import { isSentinelEdgeId } from '../../src/app/core/graph/graph.constants';
import { Counters } from '../../src/app/core/graph/graph.types';
import { mulberry32 } from '../../src/app/core/graph/prng';
import {
  GRAPH_CLASSES,
  GRAPH_CLASS_LABELS,
  GraphClass,
  generateCorpus,
  realEdges,
  realNodes,
  structuralViolations,
} from '../../src/app/core/graph/random-graph.generator';
import { assignKnuthWeights } from '../../src/app/features/cfg-import/cfg-import.adapter';
import { runFastSimulation } from '../../src/app/features/examples/simulation.engine';

const SEME = 20260819;
const GRAFOVA = 10000;
const MAX_BLOKOVA = 24;
const POKRETANJA = 50;
const MAX_KORAKA = 100000;

/** Granice grupa po velicini; poslednja grupa je otvorena nagore. */
const PRAGOVI: readonly number[] = [10, 25, 50, 100];

interface Merenje {
  klasa: GraphClass;
  n: number;
  e: number;
  brojMerenih: number;
  udeoMerenih: number;
  operacijaMereno: number;
  operacijaPuno: number;
  ustedaOperacija: number;
}

interface Zbir {
  grafova: number;
  prosecnoN: number;
  prosecnoE: number;
  prosecnoMerenih: number;
  prosecanUdeoMerenih: number;
  prosecnaUstedaOperacija: number;
  devijacijaN: number;
  devijacijaE: number;
  devijacijaMerenih: number;
  devijacijaUdeoMerenih: number;
  devijacijaUstedaOperacija: number;
  najmanjiUdeo: number;
  najveciUdeo: number;
}

function izmeri(): { merenja: Merenje[]; prekrsaji: string[] } {
  const korpus = generateCorpus(SEME, GRAFOVA, mulberry32, MAX_BLOKOVA);
  const merenja: Merenje[] = [];
  const prekrsaji: string[] = [];

  korpus.forEach((g, i) => {
    const greske = structuralViolations(g.data);
    if (greske.length > 0) {
      prekrsaji.push(`#${i} (${g.klasa}): ${greske.join(', ')}`);
      return;
    }

    assignKnuthWeights(g.data.nodes, g.data.edges);

    const n = realNodes(g.data).length;
    const grane = realEdges(g.data);
    const e = grane.length;

    const T = computeMaxWeightSpanningTree(g.data);
    const merene = new Set(
      computeInstrumentedEdgeIds(g.data, T).filter(id => !isSentinelEdgeId(id))
    );

    // Jedna simulacija sa svime merenim daje oba broja: koliko bi operacija
    // bilo uz punu instrumentaciju i koliko ih je samo nad skupom S.
    const svi = new Set(g.data.edges.map(edge => edge.id));
    const brojaci: Counters = runFastSimulation(
      g.data,
      svi,
      { runs: POKRETANJA, maxStepsPerRun: MAX_KORAKA },
      mulberry32(SEME + i)
    );

    let operacijaPuno = 0;
    let operacijaMereno = 0;
    for (const edge of grane) {
      const broj = brojaci[edge.id] ?? 0;
      operacijaPuno += broj;
      if (merene.has(edge.id)) {
        operacijaMereno += broj;
      }
    }

    merenja.push({
      klasa: g.klasa,
      n,
      e,
      brojMerenih: merene.size,
      udeoMerenih: merene.size / e,
      operacijaMereno,
      operacijaPuno,
      ustedaOperacija: operacijaPuno === 0 ? 0 : 1 - operacijaMereno / operacijaPuno,
    });
  });

  return { merenja, prekrsaji };
}

function zbir(grupa: Merenje[]): Zbir {
  const prosek = (f: (m: Merenje) => number) => grupa.reduce((s, m) => s + f(m), 0) / grupa.length;
  // Uzoracka standardna devijacija (delilac je za jedan manji od broja grafova).
  const devijacija = (f: (m: Merenje) => number) => {
    if (grupa.length < 2) {
      return 0;
    }
    const p = prosek(f);
    const suma = grupa.reduce((s, m) => s + (f(m) - p) * (f(m) - p), 0);
    return Math.sqrt(suma / (grupa.length - 1));
  };

  return {
    grafova: grupa.length,
    prosecnoN: round(prosek(m => m.n), 1),
    prosecnoE: round(prosek(m => m.e), 1),
    prosecnoMerenih: round(prosek(m => m.brojMerenih), 1),
    prosecanUdeoMerenih: round(prosek(m => m.udeoMerenih), 4),
    prosecnaUstedaOperacija: round(prosek(m => m.ustedaOperacija), 4),
    devijacijaN: round(devijacija(m => m.n), 1),
    devijacijaE: round(devijacija(m => m.e), 1),
    devijacijaMerenih: round(devijacija(m => m.brojMerenih), 1),
    devijacijaUdeoMerenih: round(devijacija(m => m.udeoMerenih), 4),
    devijacijaUstedaOperacija: round(devijacija(m => m.ustedaOperacija), 4),
    najmanjiUdeo: round(Math.min(...grupa.map(m => m.udeoMerenih)), 4),
    najveciUdeo: round(Math.max(...grupa.map(m => m.udeoMerenih)), 4),
  };
}

function round(x: number, mesta: number): number {
  const f = Math.pow(10, mesta);
  return Math.round(x * f) / f;
}

function nazivGrupePoVelicini(n: number): string {
  for (const prag of PRAGOVI) {
    if (n <= prag) {
      return `n ≤ ${prag}`;
    }
  }
  return `n > ${PRAGOVI[PRAGOVI.length - 1]}`;
}

function main(): void {
  const { merenja, prekrsaji } = izmeri();

  const poKlasi: Record<string, Zbir> = {};
  for (const klasa of GRAPH_CLASSES) {
    const grupa = merenja.filter(m => m.klasa === klasa);
    if (grupa.length > 0) {
      poKlasi[GRAPH_CLASS_LABELS[klasa]] = zbir(grupa);
    }
  }

  const poVelicini: Record<string, Zbir> = {};
  const imenaGrupa = [...PRAGOVI.map(p => `n ≤ ${p}`), `n > ${PRAGOVI[PRAGOVI.length - 1]}`];
  for (const ime of imenaGrupa) {
    const grupa = merenja.filter(m => nazivGrupePoVelicini(m.n) === ime);
    if (grupa.length > 0) {
      poVelicini[ime] = zbir(grupa);
    }
  }

  const izlaz = {
    seme: SEME,
    grafova: merenja.length,
    pokretanjaPoGrafu: POKRETANJA,
    strukturnihPrekrsaja: prekrsaji.length,
    prekrsaji: prekrsaji.slice(0, 20),
    ukupno: zbir(merenja),
    poKlasi,
    poVelicini,
  };

  process.stdout.write(JSON.stringify(izlaz, null, 2) + '\n');
}

main();
