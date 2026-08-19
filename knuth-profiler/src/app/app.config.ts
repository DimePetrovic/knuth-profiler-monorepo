import { ApplicationConfig, LOCALE_ID, provideZoneChangeDetection } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeSrCyrl from '@angular/common/locales/sr-Cyrl';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';

// Bez ovoga DecimalPipe radi po podrazumevanom `en-US`, pa se procenti u
// izvestaju ispisuju sa decimalnom tackom. Rad koristi zarez, a slike iz
// aplikacije ulaze u rad.
registerLocaleData(localeSrCyrl, 'sr-Cyrl');

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    { provide: LOCALE_ID, useValue: 'sr-Cyrl' },
  ]
};
