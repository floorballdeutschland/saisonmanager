import { APP_INITIALIZER, EnvironmentProviders, Provider } from '@angular/core';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

import { environment } from 'src/environments/environment';
import { AVAILABLE_LANGS, DEFAULT_LANG, readInitialLang } from './lang';
import { TranslocoHttpLoader } from './transloco-loader';

/**
 * Root-Provider für Transloco. In `AppModule.providers` spreaden.
 *
 * - `fallbackLang` + `useFallbackTranslation`: fehlende EN-Keys zeigen den
 *   deutschen Text statt des Roh-Keys (sichert Teil-Übersetzungen ab).
 * - Der APP_INITIALIZER setzt die persistierte Sprache und lädt die globalen
 *   Übersetzungen, bevor die App rendert (kein Aufblitzen von Keys).
 */
export function provideTranslocoRoot(): (Provider | EnvironmentProviders)[] {
  return [
    provideTransloco({
      config: {
        availableLangs: AVAILABLE_LANGS,
        defaultLang: DEFAULT_LANG,
        fallbackLang: DEFAULT_LANG,
        reRenderOnLangChange: true,
        prodMode: environment.production,
        missingHandler: {
          useFallbackTranslation: true,
          logMissingKey: !environment.production,
        },
      },
      loader: TranslocoHttpLoader,
    }),
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [TranslocoService],
      useFactory: (transloco: TranslocoService) => () => {
        const lang = readInitialLang();
        transloco.setActiveLang(lang);
        return firstValueFrom(transloco.load(lang));
      },
    },
  ];
}
