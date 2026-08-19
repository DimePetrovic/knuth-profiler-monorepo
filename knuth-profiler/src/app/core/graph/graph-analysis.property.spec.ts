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
 * Referentno brojanje putanja do izlaza, po definiciji iz rada:
 *
 *   pi(v) = 1                             ako je v = EXIT
 *   pi(v) = suma pi(w) po granama (v,w)   inace, nad DAG pogledom
 *
 * Cvor iz kog u DAG pogledu nema putanje do izlaza ima pi = 0, i to nije
 * izuzetak nego sadrzaj tvrdnje: grana koja ulazi u telo petlje je
 * strukturno najmanje znacajna i upravo nju treba meriti.
 *
 * Nezavisnost od aplikacije: povratne grane su ovde istina po konstrukciji
 * (generator ih obelezava), a ne rezultat detekcije; obilazak je rekurzivan
 * sa memoizacijom, a ne topoloski.
 */
function ocekivaneTezine(data: GraphData): Map<string, number> {
  const grane = realEdges(data);
  const aciklicne = grane.filter(edge => edge.data?.['povratna'] !== true);

  const izlazne = new Map<string, string[]>();
  for (const node of realNodes(data)) {
    izlazne.set(node.id, []);
  }
  for (const edge of aciklicne) {
    izlazne.get(edge.source)?.push(edge.target);
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

    // Graf bez povratnih grana je aciklican, pa se ovaj upis nikada ne cita
    // pre nego sto ga konacna vrednost zameni.
    memo.set(cvor, 0);
    const zbir = (izlazne.get(cvor) ?? []).reduce((acc, next) => acc + brojPutanja(next), 0);
    memo.set(cvor, zbir);
    return zbir;
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

  /**
   * Primer iz teorijske glave rada (slika sa razapinjucim stablom): petlja
   * cije telo nema drugog izlaza osim povratne grane. Rad tvrdi pi(telo) = 0,
   * pa grana KA telu ima tezinu 0 i ona se meri, dok povratna grana ulazi u
   * stablo. Cvorovi se namerno zovu kao u katalogu primera, jer se 'B' i 'D'
   * sortiraju pre 'ENTRY' — pretraga u dubinu koja ne krene iz ulaznog cvora
   * ovde proglasi pogresnu granu povratnom.
   */
  it('петља из рада: тело има $\\pi = 0$, повратна грана улази у стабло', () => {
    const petlja: GraphData = {
      nodes: [
        { id: 'ENTRY', label: 'ENTRY', kind: 'entry' },
        { id: 'I', label: 'I', kind: 'normal' },
        { id: 'D', label: 'D', kind: 'decision' },
        { id: 'B', label: 'B', kind: 'normal' },
        { id: 'EXIT', label: 'EXIT', kind: 'exit' },
      ],
      edges: [
        { id: 'e0', source: 'ENTRY', target: 'I', kind: 'normal', weight: 0 },
        { id: 'e1', source: 'I', target: 'D', kind: 'normal', weight: 0 },
        { id: 'e2', source: 'D', target: 'B', kind: 'normal', weight: 0 },
        { id: 'e3', source: 'B', target: 'D', kind: 'normal', weight: 0 },
        { id: 'e4', source: 'D', target: 'EXIT', kind: 'normal', weight: 0 },
      ],
    };

    assignKnuthWeights(petlja.nodes, petlja.edges);
    const tezina = (id: string) => petlja.edges.find(e => e.id === id)!.weight;

    expect(tezina('e2')).withContext('грана ка телу петље, $w = \\pi(B) = 0$').toBe(0);
    expect(tezina('e3')).withContext('повратна грана, $w = \\pi(D) = 1$').toBe(1);

    const T = computeMaxWeightSpanningTree(petlja);
    expect(T).withContext('повратна грана припада стаблу').toContain('e3');
    expect(T).withContext('грана ка телу петље не припада стаблу').not.toContain('e2');
    expect(computeInstrumentedEdgeIds(petlja, T).filter(id => !isSentinelEdgeId(id)))
      .withContext('мери се тачно грана ка телу петље')
      .toEqual(['e2']);
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
