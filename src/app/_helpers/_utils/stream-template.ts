import { StreamingGame } from '@floorball/types';

/**
 * YouTube schneidet längere Titel ab. Der Zähler in der Maske warnt vorher,
 * abgeschnitten wird trotzdem hier -- ein abgeschnittener Titel ist immer noch
 * besser als eine abgewiesene Anlage mitten im Stapel.
 */
export const STREAM_TITLE_MAX = 100;

/**
 * Die Platzhalter, die in Titel und Beschreibung stehen dürfen.
 *
 * Reihenfolge = Reihenfolge in der Hilfe unter dem Eingabefeld: erst die
 * Mannschaften, dann der Wettbewerb, dann Zeit und Ort.
 */
export const STREAM_PLACEHOLDERS = [
  'heim',
  'gast',
  'liga',
  'liga_kurz',
  'spieltag',
  'spielnummer',
  'datum',
  'datum_lang',
  'wochentag',
  'uhrzeit',
  'halle',
  'ort',
  'ausrichter',
  'spiel_url',
] as const;

export type StreamPlaceholder = (typeof STREAM_PLACEHOLDERS)[number];

const WOCHENTAGE = [
  'Sonntag',
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
];

/**
 * Setzt die Platzhalter einer Vorlage für ein Spiel ein.
 *
 * UNBEKANNTE PLATZHALTER BLEIBEN STEHEN. Sie stillschweigend zu löschen wäre
 * die schlechtere Antwort: Ein Tippfehler in `{spielnumer}` fiele dann erst auf,
 * wenn zwanzig Streams mit einer Lücke im Titel bei YouTube stehen. So steht er
 * in der Vorschau und ist nicht zu übersehen.
 */
export function applyStreamTemplate(
  template: string,
  game: StreamingGame
): string {
  const werte = placeholderValues(game);

  return template.replace(/\{([a-z_]+)\}/g, (treffer, name: string) =>
    name in werte ? werte[name] : treffer
  );
}

export function placeholderValues(game: StreamingGame): Record<string, string> {
  const datum = parseIsoDate(game.game_day?.date);

  return {
    heim: game.home_team_name || 'N.N.',
    gast: game.guest_team_name || 'N.N.',
    liga: game.league?.name || '',
    liga_kurz: game.league?.short_name || game.league?.name || '',
    spieltag: game.game_day?.number != null ? String(game.game_day.number) : '',
    spielnummer: game.game_number || '',
    datum: datum ? formatDate(datum, 2) : '',
    datum_lang: datum ? formatDate(datum, 4) : '',
    wochentag: datum ? WOCHENTAGE[datum.getDay()] : '',
    uhrzeit: game.start_time || '',
    halle: game.game_day?.arena?.name || '',
    ort: game.game_day?.arena?.city || '',
    ausrichter: game.game_day?.hosting_club || '',
    spiel_url: game.public_url || '',
  };
}

/**
 * Bereinigt einen fertigen Titel für YouTube.
 *
 * `<` und `>` weist die Schnittstelle ab; Zeilenumbrüche sind in einem Titel
 * nicht erlaubt und entstehen leicht beim Einfügen aus einer Tabelle. Gekürzt
 * wird an der Wortgrenze, damit nicht mitten im Vereinsnamen abgeschnitten wird.
 */
export function sanitizeStreamTitle(title: string): string {
  const bereinigt = title.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
  if (bereinigt.length <= STREAM_TITLE_MAX) return bereinigt;

  const gekuerzt = bereinigt.slice(0, STREAM_TITLE_MAX);
  const grenze = gekuerzt.lastIndexOf(' ');
  return (grenze > STREAM_TITLE_MAX - 25 ? gekuerzt.slice(0, grenze) : gekuerzt).trim();
}

/**
 * `YYYY-MM-DD` als lokales Datum.
 *
 * Nicht `new Date(text)`: Das liest die Form als UTC-Mitternacht und liefert in
 * der deutschen Zeitzone denselben Tag, in westlichen Zeitzonen aber den Vortag
 * -- der Wochentag im Titel wäre dann falsch.
 */
function parseIsoDate(value?: string | null): Date | null {
  const treffer = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!treffer) return null;

  return new Date(Number(treffer[1]), Number(treffer[2]) - 1, Number(treffer[3]));
}

function formatDate(date: Date, jahresstellen: 2 | 4): string {
  const tag = String(date.getDate()).padStart(2, '0');
  const monat = String(date.getMonth() + 1).padStart(2, '0');
  const jahr =
    jahresstellen === 2
      ? String(date.getFullYear()).slice(-2)
      : String(date.getFullYear());

  return `${tag}.${monat}.${jahr}`;
}
