import {
  RefereeCourseClubMatchType,
  RefereeCourseResult,
} from '@floorball/types';

/**
 * Hinweistext zur Herkunft eines Vereinstreffers — für die Importeurs- und die
 * Freigabe-Maske gemeinsam, damit die beiden nicht auseinanderlaufen.
 *
 * Ein exakter Treffer auf den Vereinsnamen (`name`) bekommt keinen Hinweis:
 * Dort steht in der Datei, was in der Datenbank steht. Alles andere ist eine
 * Schlussfolgerung des Systems und gehört benannt.
 */
const HINT_KEYS: Partial<Record<RefereeCourseClubMatchType, string>> = {
  alias: 'refereeCourseAdmin.detail.clubMatchAlias',
  long_name: 'refereeCourseAdmin.detail.clubMatchLongName',
  normalized_name: 'refereeCourseAdmin.detail.clubMatchNormalized',
  normalized_long_name: 'refereeCourseAdmin.detail.clubMatchNormalized',
};

export function clubMatchHintKey(result: RefereeCourseResult): string | null {
  const matchType = result.csv_club_match?.match_type;
  if (!matchType) return null;
  return HINT_KEYS[matchType] ?? null;
}
