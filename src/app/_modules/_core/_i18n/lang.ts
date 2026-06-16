/**
 * Zentrale Sprach-Konstanten für die Oberflächensprache des eingeloggten Bereichs.
 * Muss mit der API (User::LANGUAGES) übereinstimmen.
 */
export type AppLanguage = 'de' | 'en';

export const AVAILABLE_LANGS: AppLanguage[] = ['de', 'en'];
export const DEFAULT_LANG: AppLanguage = 'de';

/**
 * Liest die initiale Sprache synchron aus dem im localStorage gecachten User
 * (Key `user`, gesetzt vom SessionService). Wird vor dem ersten Render benötigt,
 * damit sowohl Transloco als auch der Angular-LOCALE_ID korrekt starten.
 * Fällt bei fehlendem/ungültigem Wert auf `de` zurück.
 */
export function readInitialLang(): AppLanguage {
  try {
    const stored = localStorage.getItem('user');
    const lang = stored
      ? (JSON.parse(stored)?.language as string | undefined)
      : undefined;
    return AVAILABLE_LANGS.includes(lang as AppLanguage)
      ? (lang as AppLanguage)
      : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}
