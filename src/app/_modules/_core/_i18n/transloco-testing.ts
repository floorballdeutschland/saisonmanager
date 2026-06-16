import {
  Translation,
  TranslocoTestingModule,
  TranslocoTestingOptions,
} from '@jsverse/transloco';

import { AVAILABLE_LANGS, DEFAULT_LANG } from './lang';

/**
 * Geteiltes Transloco-Setup für Specs. In das `imports`-Array des TestBed
 * aufnehmen. Scope-/Feature-Keys können je Test über `langs` ergänzt werden,
 * z. B. `getTranslocoTestingModule({ 'admin/league': { ... } })`.
 */
export function getTranslocoTestingModule(
  langs: Record<string, Translation> = {},
  options: TranslocoTestingOptions = {}
) {
  return TranslocoTestingModule.forRoot({
    langs: { de: {}, en: {}, ...langs },
    translocoConfig: {
      availableLangs: AVAILABLE_LANGS,
      defaultLang: DEFAULT_LANG,
      fallbackLang: DEFAULT_LANG,
      reRenderOnLangChange: true,
    },
    preloadLangs: true,
    ...options,
  });
}
