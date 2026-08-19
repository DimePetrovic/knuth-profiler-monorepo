import { Pipe, PipeTransform } from '@angular/core';
import { CfgLabelDomain, cfgLabel } from './cfg-import.labels';

/**
 * Приказује српски назив за вредност коју је вратио сервер.
 *
 *   {{ state.status?.stage | cfgLabel:'stage' }}
 */
@Pipe({
  name: 'cfgLabel',
  standalone: true,
})
export class CfgLabelPipe implements PipeTransform {
  transform(value: string | null | undefined, domain: CfgLabelDomain): string {
    return cfgLabel(value, domain);
  }
}
