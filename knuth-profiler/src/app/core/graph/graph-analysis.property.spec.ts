/**
 * Svojstva optimalnog razapinjuceg stabla i skupa instrumentovanih grana,
 * proverena nad nasumicno generisanim grafovima kontrole toka.
 *
 * Ovo nisu primeri nego tvrdnje: svaki graf iz korpusa mora ih zadovoljiti.
 * Ako neki ne zadovolji, ispis nosi klasu i redni broj grafa, pa se
 * protivprimer moze ponoviti istim semenom.
 */

import { computeInstrumentedEdgeIds, computeMaxWeightSpanningTree } from './graph-analysis';
import { EXIT_NODE_ID, isSentinelEdgeId } from './graph.constants';
import { GraphData } from './graph.types';
import { mulberry32 } from './prng';
import {
  GeneratedGraph,
  GRAPH_CLASS_LABELS,
  generateCorpus,
  realEdges,
  realNodes,
  structuralViolations,
} from './random-graph.generator';
import { assignKnuthWeights } from '../../features/cfg-import/cfg-import.adapter';

const SEME = 20260819;
const GRAFOVA = 200;

/**
 * Referentno brojanje putanja do izlaza, nezavisno od implementacije u
 * aplikaciji: povratne grane se uzimaju kao istina po konstrukciji (ne
 * detektuju se), obilazak je rekurzivan sa memoizacijom (ne topoloski).
 *
 * Konvencija je ista kao u aplikaciji i nije proizvoljna. U grafu sa petljom
 * broj putanja je beskonacan, pa se broji nad aciklicnim pogledom. Cvor iz
 * kog se u tom pogledu ne stize do izlaza — telo petlje, iz kog se izlazi
 * jedino povratnom granom — dobija pi = 1, a ne 0. Nula bi tvrdila da iz tela
 * petlje nema puta do izlaza, sto nije tacno u samom programu (uporediti K41).
 */
function ocekivaneTezine(data: GraphData): Map<string, number> {
  const grane = realEdges(data);
  const aciklicne = grane.filter(edge => edge.data?.['povratna'] !== true);

  const izlazne = new Map<string, string[]>();
  const ulazne = new Map<string, string[]>();
  for (const node of realNodes(data)) {
    izlazne.set(node.id, []);
    ulazne.set(node.id, []);
  }
  for (const edge of aciklicne) {
    izlazne.get(edge.source)?.push(edge.target);
    ulazne.get(edge.target)?.push(edge.source);
  }

  // Unazad od izlaza: koji cvorovi uopste stizu do njega bez povratnih grana.
  const stizeDoIzlaza = new Set<string>([EXIT_NODE_ID]);
  const stek = [EXIT_NODE_ID];
  while (stek.length > 0) {
    const cur = stek.pop()!;
    for (const prethodnik of ulazne.get(cur) ?? []) {
      if (!stizeDoIzlaza.has(prethodnik)) {
        stizeDoIzlaza.add(prethodnik);
        stek.push(prethodnik);
      }
    }
  }

  const memo = new Map<string, number>();
  const brojPutanja = (cvor: string): number => {
    if (cvor === EXIT_NODE_ID) {
      return 1;
    }
    const zapamceno = memo.get(cvor);
    if (zapamceno !== undefined) {
      return zapamceno;
    }

    const nastavci = (izlazne.get(cvor) ?? []).filter(next => stizeDoIzlaza.has(next));
    const vrednost =
      nastavci.length === 0
        ? 1
        : Math.max(1, nastavci.reduce((acc, next) => acc + brojPutanja(next), 0));

    memo.set(cvor, vrednost);
    return vrednost;
  };

  const tezine = new Map<string, number>();
  for (const edge of grane) {
    tezine.set(edge.id, brojPutanja(edge.target));
  }

  return tezine;
}

/** Da li skup grana povezuje sve cvorove, gledano kao neusmeren graf. */
function povezujeSve(data: GraphData, edgeIds: ReadonlySet<string>): boolean {
  const cvorovi = realNodes(data).map(node => node.id);
  const roditelj = new Map<string, string>(cvorovi.map(id => [id, id]));

  const nadji = (x: string): string => {
    let cur = x;
    while (roditelj.get(cur) !== cur) {
      cur = roditelj.get(cur)!;
    }
    return cur;
  };

  for (const edge of realEdges(data)) {
    if (!edgeIds.has(edge.id)) {
      continue;
    }
    const a = nadji(edge.source);
    const b = nadji(edge.target);
    if (a !== b) {
      roditelj.set(a, b);
    }
  }

  const koren = nadji(cvorovi[0]);
  return cvorovi.every(id => nadji(id) === koren);
}

function opis(g: GeneratedGraph, i: number): string {
  return `граф #${i} (${GRAPH_CLASS_LABELS[g.klasa]}, ${g.blokova} блока)`;
}

describe('Својства Кнутовог алгоритма над насумичним графовима', () => {
  let korpus: GeneratedGraph[];

  beforeAll(() => {
    korpus = generateCorpus(SEME, GRAFOVA, mulberry32);
    for (const g of korpus) {
      assignKnuthWeights(g.data.nodes, g.data.edges);
    }
  });

  it('генерисани графови су структурно исправни', () => {
    korpus.forEach((g, i) => {
      expect(structuralViolations(g.data)).withContext(opis(g, i)).toEqual([]);
    });
  });

  it('свака класа и више величина су заступљене', () => {
    const klase = new Set(korpus.map(g => g.klasa));
    const velicine = new Set(korpus.map(g => realNodes(g.data).length));
    expect(klase.size).toBe(6);
    expect(velicine.size).toBeGreaterThan(5);
  });

  // Својство 1
  it('|T| = n - 1, и T повезује све чворове', () => {
    korpus.forEach((g, i) => {
      const n = realNodes(g.data).length;
      const T = computeMaxWeightSpanningTree(g.data);

      expect(T.length).withContext(`${opis(g, i)}: |T|`).toBe(n - 1);
      expect(T.some(id => isSentinelEdgeId(id))).withContext(`${opis(g, i)}: T садржи граничну грану`).toBeFalse();
      expect(povezujeSve(g.data, new Set(T))).withContext(`${opis(g, i)}: T не повезује све чворове`).toBeTrue();
    });
  });

  // Својство 2
  it('|S| = e - n + 1', () => {
    korpus.forEach((g, i) => {
      const n = realNodes(g.data).length;
      const e = realEdges(g.data).length;
      const T = computeMaxWeightSpanningTree(g.data);
      const S = computeInstrumentedEdgeIds(g.data, T).filter(id => !isSentinelEdgeId(id));

      expect(S.length).withContext(`${opis(g, i)}: n=${n}, e=${e}`).toBe(e - n + 1);
    });
  });

  // Својство 3
  it('S и T су дисјунктни и заједно дају све гране', () => {
    korpus.forEach((g, i) => {
      const T = computeMaxWeightSpanningTree(g.data);
      const S = computeInstrumentedEdgeIds(g.data, T).filter(id => !isSentinelEdgeId(id));
      const skupT = new Set(T);
      const skupS = new Set(S);

      expect(S.filter(id => skupT.has(id))).withContext(`${opis(g, i)}: пресек`).toEqual([]);
      expect(skupS.size + skupT.size).withContext(`${opis(g, i)}: дупликати`).toBe(S.length + T.length);

      const unija = new Set([...skupS, ...skupT]);
      const sve = realEdges(g.data).map(edge => edge.id).sort();
      expect([...unija].sort()).withContext(`${opis(g, i)}: унија`).toEqual(sve);
    });
  });

  // Својство 5
  it('тежине једнаке броју путања до излаза, уз искључене повратне гране', () => {
    korpus.forEach((g, i) => {
      const ocekivano = ocekivaneTezine(g.data);

      for (const edge of realEdges(g.data)) {
        expect(edge.weight)
          .withContext(`${opis(g, i)}: тежина гране ${edge.id} (${edge.source}→${edge.target})`)
          .toBe(ocekivano.get(edge.id)!);
      }
    });
  });

  /**
   * Граничне гране се изузимају по идентитету, не по вредности тежине.
   * Мера „тежина > 0“, коју је алат раније користио, овде обара стабло на
   * празан скуп. Сопствена додела тежина никада не даје нулу, па се ова
   * разлика на редовном корпусу не види — зато засебна тврдња.
   */
  it('стабло се бира по идентитету граничних грана, не по вредности тежине', () => {
    korpus.forEach((g, i) => {
      const n = realNodes(g.data).length;
      const bezTezina: GraphData = {
        nodes: g.data.nodes,
        edges: g.data.edges.map(edge => ({ ...edge, weight: 0 })),
      };

      const T = computeMaxWeightSpanningTree(bezTezina);
      expect(T.length).withContext(`${opis(g, i)}: |T| уз све тежине једнаке нули`).toBe(n - 1);
      expect(povezujeSve(bezTezina, new Set(T))).withContext(`${opis(g, i)}: повезаност`).toBeTrue();

      const S = computeInstrumentedEdgeIds(bezTezina, T).filter(id => !isSentinelEdgeId(id));
      expect(S.length).withContext(`${opis(g, i)}: |S| уз све тежине једнаке нули`).toBe(
        realEdges(g.data).length - n + 1
      );
    });
  });

  it('гранична грана ка излазу се никада не инструментује, а улазна увек', () => {
    korpus.forEach((g, i) => {
      const T = computeMaxWeightSpanningTree(g.data);
      const S = computeInstrumentedEdgeIds(g.data, T);

      expect(S).withContext(opis(g, i)).toContain('__entry_sentinel__');
      expect(S).withContext(opis(g, i)).not.toContain('__exit_sentinel__');
    });
  });
});
