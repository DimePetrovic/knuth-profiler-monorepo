import { VizStep } from '../../core/graph/graph.types';

export interface WorkflowStepMetadata {
  id: VizStep;
  badgeTitle: string;
  cfgPageTitle: string;
  cfgSubtitle: string;
  examplesSubtitle: string;
  description: string;
}

export const WORKFLOW_STEP_METADATA: Record<VizStep, WorkflowStepMetadata> = {
  0: {
    id: 0,
    badgeTitle: 'Корак 1',
    cfgPageTitle: 'Корак 1: Увоз CFG-а',
    cfgSubtitle: 'Унеси или отпреми изворни код, покрени CFG обраду и сачекај успешан резултат посла.',
    examplesSubtitle: 'Изабери пример контролисаног тока и покрени визуализацију корак по корак.',
    description: 'Старт – прикажи граф. Кликни „Покрени визуализацију“.',
  },
  1: {
    id: 1,
    badgeTitle: 'Корак 2: Ball-Larus тежине',
    cfgPageTitle: 'Корак 2: Ball-Larus тежине',
    cfgSubtitle: 'Тежине грана се додељују према Ball-Larus стратегији како би следећи кораци пратили структуру путања кроз CFG.',
    examplesSubtitle: 'Ball-Larus тежине истичу структурни значај грана и припремају граф за MST и селективну инструментацију.',
    description: 'Ball-Larus тежине – на свакој грани је приказана ознака w=тежина добијена Ball-Larus стратегијом.',
  },
  2: {
    id: 2,
    badgeTitle: 'Корак 3: MST',
    cfgPageTitle: 'Корак 3: MST',
    cfgSubtitle: 'Приказује се максимално разапињуће стабло као основа за селективну инструментацију.',
    examplesSubtitle: 'Максимално разапињуће стабло издваја кључне гране за ефикасну реконструкцију.',
    description: 'MST – истакнуте су гране које чине максимално разапињуће стабло (по тежинама > 0).',
  },
  3: {
    id: 3,
    badgeTitle: 'Корак 4: Инструментација',
    cfgPageTitle: 'Корак 4: Инструментација',
    cfgSubtitle: 'Означавају се гране за инструментацију, односно оне које се прате бројачима током извршавања.',
    examplesSubtitle: 'Овај корак приказује које су гране инструментисане ради минималног трошка мерења.',
    description: 'Инструментација – означене су испрекиданом линијом гране које треба мерити.',
  },
  4: {
    id: 4,
    badgeTitle: 'Корак 5: Мерења',
    cfgPageTitle: 'Корак 5: Мерења',
    cfgSubtitle: 'Покрени симулацију и прикупи мерења како би бројачи инструментисаних грана били попуњени.',
    examplesSubtitle: 'Извршава се симулација и попуњавају се бројачи инструментисаних грана.',
    description: 'Мерења – изабери број покретања и покрени симулацију. Током симулације видиш бројаче на инструментизованим гранама.',
  },
  5: {
    id: 5,
    badgeTitle: 'Корак 6: Реконструкција',
    cfgPageTitle: 'Корак 6: Реконструкција',
    cfgSubtitle: 'На основу познатих бројача реконструиши преостале вредности и добије се потпуна слика пролазака.',
    examplesSubtitle: 'Реконструишу се недостајуће вредности на основу познатих бројања и баланса тока.',
    description: 'Реконструкција – приказ броја пролазака по свим гранама.',
  },
  6: {
    id: 6,
    badgeTitle: 'Корак 7: Извештај',
    cfgPageTitle: 'Корак 7: Извештај',
    cfgSubtitle: 'Извештај приказује метрике, упоређује трошак и истиче ефекат селективне инструментације.',
    examplesSubtitle: 'Извештај сумира резултате, пореди трошкове и даје процену добити приступа.',
    description: 'Извештај – преглед показатеља ефеката селективне инструментације.',
  },
};

export const WORKFLOW_STEP_SEQUENCE = Object.values(WORKFLOW_STEP_METADATA).sort((a, b) => a.id - b.id);

export function getWorkflowStepMetadata(step: VizStep): WorkflowStepMetadata {
  return WORKFLOW_STEP_METADATA[step];
}
