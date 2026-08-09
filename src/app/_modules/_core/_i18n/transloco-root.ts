import { APP_INITIALIZER, EnvironmentProviders, Provider } from '@angular/core';
import {
  provideTransloco,
  Translation,
  TranslocoService,
} from '@jsverse/transloco';
import { catchError, firstValueFrom, of } from 'rxjs';

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
      useFactory: loadInitialTranslations,
    },
  ];
}

/**
 * Lädt die globalen Übersetzungen, bevor die App rendert.
 *
 * Scheitert der Abruf, startet die Anwendung trotzdem. Ein APP_INITIALIZER, der
 * ablehnt, bricht den Bootstrap ab, und dann steht eine leere Seite da. Eine
 * kurz gestörte Leitung darf das nicht auslösen: Eine Oberfläche mit fehlenden
 * Übersetzungen ist immer noch besser als gar keine, und Transloco lädt die
 * Datei beim nächsten Zugriff ohnehin erneut.
 *
 * Abgesichert sind beide Wege, auf denen der Abruf enden kann, denn sie
 * verhalten sich verschieden:
 *
 * - Der Stream **bricht ab**: Das fängt `catchError`.
 * - Der Stream **schließt ohne Wert ab**: Dagegen hilft `catchError` nicht, nur
 *   der `defaultValue`. Ohne ihn wirft `firstValueFrom` einen
 *   `EmptyError: no elements in sequence` — genau der Fall, der in Produktion
 *   auftrat (Sentry SAISONMANAGER-2K, sechs Vorfälle an einem Tag, während die
 *   Sprachdateien selbst durchgehend mit HTTP 200 auslieferbar waren).
 */
export function loadInitialTranslations(
  transloco: TranslocoService
): () => Promise<Translation | null> {
  return () => {
    const lang = readInitialLang();
    transloco.setActiveLang(lang);

    return firstValueFrom(
      transloco.load(lang).pipe(catchError(() => of(null))),
      { defaultValue: null }
    );
  };
}
