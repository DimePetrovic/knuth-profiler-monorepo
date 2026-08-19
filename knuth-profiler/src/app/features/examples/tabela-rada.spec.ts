/**
 * Табела сажетка у раду наспрам онога што апликација заиста израчуна.
 *
 * Рад у табели наводи три реда бројева о примерима. Ти бројеви су тврдња у
 * тексту коју ништа није проверавало, а апликација се од рада већ двапут
 * разишла — око тежина и око броја чворова. Овај тест држи ту табелу и
 * апликацију везане: ако се пример, бројање или алгоритам промене, пада
 * тачно онај ред који више не важи.
 *
 * Бројеви се НЕ прилагођавају тесту. Ако тест падне, или рад или апликација
 * говоре неистину, и то се решава на извору.
 */
import { TestBed } from '@angular/core/testing';
import {
  computeInstrumentedEdgeIds,
  computeMaxWeightSpanningTree,
} from '../../core/graph/graph-analysis';
import { isSentinelEdgeId } from '../../core/graph/graph.constants';
import { GraphData } from '../../core/graph/graph.types';
import { mapCfgJsonToGraphData } from '../cfg-import/cfg-import.adapter';
import { SIGN_JOERN_RESULT } from '../cfg-import/testing/sign-joern.fixture';
import { ExamplesCatalogService } from './examples-catalog.service';
import { WorkflowReportService } from './workflow-report.service';

interface Red {
  naziv: string;
  n: number;
  e: number;
  s: number;
}

/** Дословно из `tab:evaluacija-sazetak` у `poglavlja/implementacija.tex`. */
const TABELA: Record<string, Red> = {
  'if-else': { naziv: 'Линеарни ток и гранање', n: 7, e: 7, s: 1 },
  'while-loop': { naziv: 'Петља', n: 5, e: 5, s: 1 },
  uvoz: { naziv: 'Увезени код', n: 8, e: 9, s: 2 },
};

describe('Табела сажетка у раду', () => {
  let izvestaj: WorkflowReportService;
  let katalog: ExamplesCatalogService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    izvestaj = TestBed.inject(WorkflowReportService);
    katalog = TestBed.inject(ExamplesCatalogService);
  });

  function izmeri(data: GraphData) {
    const T = computeMaxWeightSpanningTree(data);
    const S = computeInstrumentedEdgeIds(data, T);
    const m = izvestaj.buildMetrics(data, S, {});
    return {
      n: m.nodeCount,
      e: m.edgeCount,
      s: m.instrumentedEdgeCount,
      merenihBezGranicnih: S.filter(id => !isSentinelEdgeId(id)).length,
    };
  }

  for (const kljuc of ['if-else', 'while-loop'] as const) {
    const red = TABELA[kljuc];

    it(`ред „${red.naziv}“ одговара примеру ${kljuc}`, () => {
      const primer = katalog.list().find(p => p.id === kljuc);
      expect(primer).withContext(`пример ${kljuc} више не постоји у каталогу`).toBeDefined();

      const r = izmeri(primer!.data);

      expect([r.n, r.e, r.s])
        .withContext(`рад тврди n=${red.n}, e=${red.e}, |S|=${red.s}`)
        .toEqual([red.n, red.e, red.s]);
      expect(r.s).withContext('колона $e - n + 1$').toBe(red.e - red.n + 1);
    });
  }

  it(`ред „${TABELA['uvoz'].naziv}“ одговара графу који је дао алат Joern`, () => {
    const red = TABELA['uvoz'];
    const data = mapCfgJsonToGraphData(SIGN_JOERN_RESULT);
    const r = izmeri(data);

    expect([r.n, r.e, r.s])
      .withContext(`рад тврди n=${red.n}, e=${red.e}, |S|=${red.s}`)
      .toEqual([red.n, red.e, red.s]);
    expect(r.s).withContext('колона $e - n + 1$').toBe(red.e - red.n + 1);
  });

  it('уз сваки пример се мери мање грана него што их граф има', () => {
    for (const primer of katalog.list()) {
      const r = izmeri(primer.data);
      expect(r.merenihBezGranicnih)
        .withContext(`пример ${primer.id}`)
        .toBeLessThan(r.e);
    }
  });
});
