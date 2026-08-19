/**
 * Српски називи за вредности које стижу са сервера.
 *
 * Вредности су дефинисане у `knuth-backend/app/models.py` (`JobStatus`,
 * `JobStage` и поље `code` у `CfgErrorPayload`). Мапа стоји на једном месту;
 * две копије исте мапе се временом разиђу.
 */

export type CfgLabelDomain = 'status' | 'stage' | 'code';

/** `JobStatus` — стање самог посла. */
export const CFG_STATUS_LABELS: Readonly<Record<string, string>> = {
  queued: 'на чекању',
  running: 'у обради',
  completed: 'завршено',
  failed: 'неуспешно',
};

/**
 * `JobStage` — докле је обрада стигла. Када посао падне, фаза остаје на
 * последњој познатој вредности, па се приказују и „неуспешне“ фазе.
 */
export const CFG_STAGE_LABELS: Readonly<Record<string, string>> = {
  queued: 'на чекању',
  'writing-source': 'уписивање изворног кода',
  joern: 'анализа алатом Joern',
  extract: 'извлачење графа',
  normalize: 'нормализација графа',
  done: 'готово',
};

/**
 * Шифре грешака. Три од шест (`UNSUPPORTED_LANGUAGE`, `SYNTAX_ERROR`,
 * `VALIDATION_ERROR`) сервер тренутно нигде не поставља, али су део уговора.
 */
export const CFG_CODE_LABELS: Readonly<Record<string, string>> = {
  JOERN_FAILED: 'анализа кода није успела',
  UNSUPPORTED_LANGUAGE: 'језик није подржан',
  SYNTAX_ERROR: 'синтаксна грешка у коду',
  TIMEOUT: 'истекло је време обраде',
  INTERNAL_ERROR: 'интерна грешка сервера',
  VALIDATION_ERROR: 'неисправан захтев',
};

const LABELS_BY_DOMAIN: Readonly<Record<CfgLabelDomain, Readonly<Record<string, string>>>> = {
  status: CFG_STATUS_LABELS,
  stage: CFG_STAGE_LABELS,
  code: CFG_CODE_LABELS,
};

/** Празна вредност даје цртицу, непозната се приказује онаква каква је стигла. */
export function cfgLabel(value: string | null | undefined, domain: CfgLabelDomain): string {
  if (!value) {
    return '—';
  }

  return LABELS_BY_DOMAIN[domain][value] ?? value;
}
