/**
 * Mindestens ein Element. Der Server liefert nie eine leere Spieltagsliste
 * (Gruppen ohne abgedeckten Spieltag werden gar nicht erst ausgegeben) – mit
 * diesem Typ steht das im Vertrag, statt dass jeder Aufrufer sich einzeln
 * dagegen absichert.
 */
export type NonEmptyArray<T> = [T, ...T[]];

/**
 * Ein Spieltag, wie ihn die Sekretariats-Übersicht ausweist.
 *
 * Nullable statt optional: Rails' `render json:` lässt keine Schlüssel weg, ein
 * fehlender Wert kommt als `null` an, nicht als `undefined`.
 */
export interface SecretaryGameDayStub {
  id: number;
  number: number | null;
  date: string;
  league: string | null;
  league_id: number | null;
  games_count: number;
}

export interface SecretaryLinkInfo {
  expires_at: string;
  created_by: string | null;
  game_day_ids: number[];
}

/**
 * Ein Spieltag, wie ihn der tokenauthentifizierte Sekretariatsblick sieht:
 * ohne Spielzahl, dafür mit Halle und Verbands-Slug für den Link zur Spielseite.
 */
export interface SecretaryTokenGameDay {
  id: number;
  date: string;
  league: string;
  league_id: number | null;
  arena: string | null;
  game_operation_slug: string | null;
}

/**
 * Alle Spieltage, die am selben Tag in derselben Halle laufen. Das Sekretariat
 * sitzt pro Halle am Tisch, nicht pro Liga – ein Link deckt deshalb die ganze
 * Gruppe ab.
 *
 * Halle und Hallenname hängen zusammen: Gruppiert wird nach `arena_id`, und der
 * Name stammt aus derselben Halle. Entweder ist beides gesetzt oder keines,
 * deshalb eine Union statt dreier unabhängiger Felder.
 *
 * `other_game_days_in_hall` sind die Spieltage derselben Halle, für die der
 * angemeldeten Person die Berechtigung fehlt. Sie stecken nicht im Link und
 * werden nur genannt, damit erkennbar bleibt, warum ein Spiel fehlt. Leer ist
 * hier ein sinnvoller Wert.
 */
export type SecretaryHallDay = {
  date: string;
  game_days: NonEmptyArray<SecretaryGameDayStub>;
  other_game_days_in_hall: SecretaryGameDayStub[];
  link: SecretaryLinkInfo | null;
} & (
  | { arena_id: number; arena: string; arena_city: string | null }
  | { arena_id: null; arena: null; arena_city: null }
);
