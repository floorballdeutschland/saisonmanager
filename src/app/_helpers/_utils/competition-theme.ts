/**
 * Farbwelt und Bildmarke eines Wettbewerbs.
 *
 * ZWEITFASSUNG. Dieselbe Ableitung steht als Vanilla-JS in `overlay/overlay.js`
 * (`competitionKey`, `LOWER_CLASSES`, `KNOWN_THEMES`, `COMPETITION_MARKS`) und
 * als Farbblöcke in `overlay/overlay.css`. Die Bühne liegt außerhalb des
 * Angular-Builds und lässt sich von hier nicht importieren, deshalb gibt es die
 * Regeln zweimal. Beide Seiten MÜSSEN dieselbe Antwort geben: Ein Thumbnail im
 * Bild einer anderen Liga als die Anzeigetafel derselben Übertragung ist ein
 * sichtbarer Fehler. Wer hier etwas ändert, ändert es dort mit.
 *
 * Die Zuordnung läuft bewusst NICHT über die league_id: Ligen sind Zeilen je
 * Saison, eine Liga-Kopie zur neuen Saison bekommt eine neue id. Über die id
 * zugeordnet fiele jedes Erscheinungsbild zum Saisonwechsel still auf den
 * Standard zurück.
 */

export type CompetitionKey =
  | '1fbl-m'
  | '1fbl-w'
  | '2fbl-m'
  | '2fbl-w'
  | 'pokal'
  | 'regional'
  | 'damen'
  | 'neutral';

/**
 * Was von einer Liga gebraucht wird. Strukturell und nicht `League`, damit auch
 * ein Teilabruf reicht: Der öffentliche Ligaabruf liefert all diese Felder,
 * andere Aufrufer haben womöglich nur einen Teil.
 */
export interface CompetitionSource {
  league_type?: string | null;
  league_class_id?: string | null;
  female?: boolean | null;
  name?: string | null;
  logo_url?: string | null;
  logo_source?: 'league' | 'state_association' | null;
}

export interface CompetitionPalette {
  /** Akzent für Kicker, Linien und Auszeichnungen. */
  accent: string;
  /** Zweiter Ton des Akzentverlaufs. */
  accentAlt: string;
}

/** Grundfarben der Bühne, für alle Wettbewerbe gleich (`overlay.css :root`). */
export const OVERLAY_COLORS = {
  primary: '#1a1a2e',
  secondary: '#16213e',
  surface: '#0f0f23',
  text: '#f1f1f1',
  textMuted: '#a0a0a0',
} as const;

/**
 * Akzente je Wettbewerb, aus `overlay.css`. `1fbl-m` und `neutral` teilen sich
 * die Werte aus `:root`: Das Bild der 1. Herren IST der Standard. Der
 * Unterschied zwischen beiden liegt nicht in der Farbe, sondern in der
 * Bildmarke, siehe COMPETITION_MARKS.
 */
const PALETTES: Record<CompetitionKey, CompetitionPalette> = {
  '1fbl-m': { accent: '#e94560', accentAlt: '#ff6b35' },
  neutral: { accent: '#e94560', accentAlt: '#ff6b35' },
  '1fbl-w': { accent: '#c86dd7', accentAlt: '#8e7bff' },
  damen: { accent: '#c86dd7', accentAlt: '#8e7bff' },
  '2fbl-m': { accent: '#2ec4b6', accentAlt: '#2b9bd8' },
  '2fbl-w': { accent: '#4fc46a', accentAlt: '#a5d63f' },
  pokal: { accent: '#f2c14e', accentAlt: '#f9a03f' },
  regional: { accent: '#7fb3ff', accentAlt: '#5b8def' },
};

/**
 * Mitgelieferte Bildmarken, ausgeliefert aus `overlay/img/` (in `angular.json`
 * als Asset nach `/overlay/` kopiert, also dieselbe Herkunft wie die Anwendung
 * und damit für eine Leinwand unbedenklich).
 *
 * Ein Zeichen ist eine Tatsachenbehauptung, deshalb hat nur ein ZUGEORDNETER
 * Wettbewerb eines: die vier Bundesligen und der Pokal. `damen`, `neutral` und
 * `regional` sind gerade die Schlüssel für „nicht zuzuordnen".
 */
const COMPETITION_MARKS: Partial<Record<CompetitionKey, string>> = {
  '1fbl-m': '/overlay/img/1-fbl-herren-weiss.png',
  '1fbl-w': '/overlay/img/1-fbl-damen-weiss.png',
  '2fbl-m': '/overlay/img/2-fbl-herren-weiss.png',
  '2fbl-w': '/overlay/img/2-fbl-damen-weiss.png',
  pokal: '/overlay/img/pokal-weiss.png',
};

/** Regional-, Verbands- und Landesliga teilen sich eine Farbwelt. */
const LOWER_CLASSES = new Set(['rl', 'vl', 'll']);

/**
 * Die Schlüssel, die einen ERKANNTEN Wettbewerb bezeichnen. Gebraucht, um zu
 * trennen, ob ein berechneter Schlüssel wirklich etwas bedeutet oder ins Leere
 * zeigt.
 */
const KNOWN_THEMES = new Set<string>([
  '1fbl-m',
  '1fbl-w',
  '2fbl-m',
  '2fbl-w',
  'pokal',
  'regional',
]);

/**
 * Wettbewerbsschlüssel einer Liga.
 *
 * Ohne Liga `neutral` und nicht etwa das Bild der 1. Herren: Solange die Daten
 * fehlen, darf keine Wortmarke behauptet werden. (Die Bühne gibt an dieser
 * Stelle einen leeren Schlüssel zurück und lässt damit das Standardaussehen
 * stehen. Sie darf das, weil sie nur einen Sekundenbruchteil ohne Daten ist und
 * das Zeichen währenddessen ohnehin ausgeblendet bleibt; ein Thumbnail dagegen
 * wird genau in diesem Zustand heruntergeladen.)
 */
export function competitionKey(
  league?: CompetitionSource | null
): CompetitionKey {
  if (!league) return 'neutral';

  // Pokalwettbewerbe zuerst. Maßgeblich ist `league_type`, nicht der Name:
  // Die Formularprüfung verlangt eine Ligaklasse NUR bei `league_modus ==
  // 'league'`, Pokale und Meisterschaften haben also planmäßig keine und sind
  // unten gar nicht zuzuordnen.
  if (league.league_type === 'cup') return 'pokal';
  // Eine Meisterschaft ist keine Bundesliga-Partie. Eigene Farben hat sie
  // nicht, aber die Wortmarke gehört nicht in ihr Bild.
  if (league.league_type === 'champ')
    return league.female ? 'damen' : 'neutral';

  // Der Name bleibt als Rückfall, falls `league_type` fehlt (ältere API). Dann
  // aber mit allen drei üblichen Schreibweisen: Auf Prod heißen mehrere
  // Pokalwettbewerbe „Floorball Deutschland Cup" oder „Trophy", keiner davon
  // enthält „Pokal".
  if (
    !league.league_type &&
    /pokal|cup|trophy/i.test(String(league.name ?? ''))
  ) {
    return 'pokal';
  }

  const leagueClass = league.league_class_id ?? '';
  let key = '';
  if (LOWER_CLASSES.has(leagueClass)) {
    key = 'regional';
  } else if (leagueClass) {
    key = leagueClass + (league.female ? '-w' : '-m');
  }

  if (KNOWN_THEMES.has(key)) return key as CompetitionKey;

  // Ab hier ist der Wettbewerb NICHT zuzuordnen. Zwei Wege führen hierher, und
  // beide gibt es im Bestand: eine leere `league_class_id` (die Validierung an
  // League erlaubt blank) und ein Altwert wie „10", den die API als rohe Spalte
  // weitergibt. Bei einer Damen-Liga wäre der Standard sichtbar falsch, deshalb
  // trägt `damen` die Farbwelt der 1. Damen. Die Bundesliga-Wortmarke bleibt in
  // beiden Fällen aus.
  return league.female ? 'damen' : 'neutral';
}

export function competitionPalette(key: CompetitionKey): CompetitionPalette {
  return PALETTES[key] ?? PALETTES.neutral;
}

/** Mitgelieferte Bildmarke des Wettbewerbs, oder null. */
export function competitionMarkUrl(key: CompetitionKey): string | null {
  return COMPETITION_MARKS[key] ?? null;
}

/**
 * Das anzuzeigende Zeichen: Vorrang hat ein hochgeladenes LIGAZEICHEN, sonst
 * greift die mitgelieferte Marke des erkannten Wettbewerbs.
 *
 * `logo_source` entscheidet mit: Der öffentliche Ligaabruf fällt auf das Logo
 * des Landesverbands zurück, wenn die Liga keines hat. Im Livestream stünde das
 * an dieser Stelle für den falschen Zusammenhang, deshalb zählt hier nur ein
 * echtes Ligazeichen.
 */
export function leagueMarkUrl(
  league?: CompetitionSource | null,
  key?: CompetitionKey
): string | null {
  const resolvedKey = key ?? competitionKey(league);

  if (league?.logo_url && league.logo_source === 'league') {
    return league.logo_url;
  }

  return competitionMarkUrl(resolvedKey);
}
