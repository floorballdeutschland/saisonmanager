import { Game } from '@floorball/types';

/**
 * Ergebniskachel für die sozialen Netze.
 *
 * Nach dem Spiel bauen Vereine das Ergebnisbild für Instagram und Co. von Hand
 * nach, oft in Canva, jedes Mal neu und jedes Mal etwas anders. Die Daten
 * liegen vollständig vor, und die Gestaltung gibt es seit den Overlays
 * ebenfalls.
 *
 * IM BROWSER GERENDERT, nicht serverseitig. Das war die Wahl aus dem Issue: Es
 * braucht keinen Server und keine Bilderzeugung in der Anwendung, die es dort
 * bisher nicht gibt.
 *
 * Direkt auf ein `<canvas>` und ohne html2canvas: Alle Bilder (Vereinslogos)
 * kommen von derselben Herkunft, die Zeichenfläche bleibt damit „untainted" und
 * `toBlob` funktioniert. Eine zusätzliche Abhängigkeit für ein Bild mit acht
 * Textzeilen wäre nicht verhältnismäßig.
 *
 * NAMEN MINDERJÄHRIGER: Diese Kachel nennt Torschützinnen und Torschützen. Bei
 * den Overlays war das unkritisch, weil in der Bundesliga Erwachsene spielen.
 * Für Jugendligen ist vorher zu klären, ob Namen darauf erscheinen dürfen;
 * `showScorers` ist der Schalter dafür und steht bewusst nicht fest auf true.
 */

export type ResultTileFormat = 'story' | 'square';

/** Story für Instagram-Stories, Quadrat für den Feed. Mehr Formate kosten Pflege und bringen wenig. */
const SIZES: Record<ResultTileFormat, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
};

// Dieselben Werte wie in overlay/overlay.css. Bewusst hier kopiert und nicht aus
// dem Stylesheet gelesen: Die Bühne liegt außerhalb der Angular-App, und ein
// Canvas kennt keine CSS-Variablen.
const COLORS = {
  backgroundTop: '#1a1a2e',
  backgroundBottom: '#16213e',
  accent: '#e94560',
  accentAlt: '#ff6b35',
  text: '#f1f1f1',
  muted: '#a0a0a0',
  plate: '#ffffff',
};

const DISPLAY_FONT = 'Oswald';
const BODY_FONT = 'Inter';

export interface ResultTileInput {
  game: Game;
  format: ResultTileFormat;
  /**
   * Torschützinnen und Torschützen mit Namen nennen. Standard false, siehe den
   * Hinweis zu Minderjährigen im Kopf dieser Datei.
   */
  showScorers?: boolean;
}

/**
 * Lädt die beiden Schriften der Overlays nach, damit die Kachel aussieht wie die
 * Bühne. Ohne das zeichnete der Canvas in der Systemschrift.
 *
 * Fehlschläge sind bewusst harmlos: Eine Kachel in einer anderen Schrift ist
 * brauchbar, keine Kachel nicht.
 */
async function ensureFonts(): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;

  const faces = [
    new FontFace(
      DISPLAY_FONT,
      "url('/overlay/fonts/oswald-latin-var.woff2') format('woff2')",
      { weight: '400 700' }
    ),
    new FontFace(
      BODY_FONT,
      "url('/overlay/fonts/inter-latin-var.woff2') format('woff2')",
      { weight: '100 900' }
    ),
  ];

  await Promise.all(
    faces.map(async (face) => {
      try {
        const loaded = await face.load();
        document.fonts.add(loaded);
      } catch {
        // Systemschrift ist der Rückfall.
      }
    })
  );
}

/**
 * Lädt ein Bild. Gibt null zurück, statt zu werfen: Ein fehlendes Vereinslogo
 * darf die Kachel nicht verhindern.
 */
function loadImage(
  src: string | null | undefined
): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, COLORS.backgroundTop);
  gradient.addColorStop(1, COLORS.backgroundBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Akzentkante oben, wie die Kante an Anzeigetafel und Bauchbinde.
  const accent = ctx.createLinearGradient(0, 0, width, 0);
  accent.addColorStop(0, COLORS.accent);
  accent.addColorStop(1, COLORS.accentAlt);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, width, 14);
}

/** Logo auf heller Platte, wie der Logo-Chip der Anzeigetafel. */
function drawCrest(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  centerX: number,
  centerY: number,
  size: number
): void {
  if (!img) return;

  const radius = 16;
  const left = centerX - size / 2;
  const top = centerY - size / 2;

  ctx.fillStyle = COLORS.plate;
  ctx.beginPath();
  ctx.roundRect(left, top, size, size, radius);
  ctx.fill();

  // Seitenverhältnis erhalten: Ein in ein Quadrat gequetschtes Vereinswappen
  // fällt sofort auf.
  const padding = size * 0.12;
  const box = size - padding * 2;
  const scale = Math.min(box / img.width, box / img.height);
  const drawWidth = img.width * scale;
  const drawHeight = img.height * scale;

  ctx.drawImage(
    img,
    centerX - drawWidth / 2,
    centerY - drawHeight / 2,
    drawWidth,
    drawHeight
  );
}

function centeredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  color: string
): void {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
}

/** Bricht einen Namen auf die verfügbare Breite, statt ihn über den Rand zu schreiben. */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  buildFont: (size: number) => string,
  startSize: number,
  minSize: number
): string {
  let size = startSize;
  ctx.font = buildFont(size);
  while (ctx.measureText(text).width > maxWidth && size > minSize) {
    size -= 2;
    ctx.font = buildFont(size);
  }
  return buildFont(size);
}

function periodLine(game: Game): string {
  const result = game.result as
    | { home_goals_period?: number[]; guest_goals_period?: number[] }
    | undefined;
  const home = result?.home_goals_period ?? [];
  const guest = result?.guest_goals_period ?? [];

  const parts: string[] = [];
  for (let i = 0; i < Math.min(home.length, guest.length); i++) {
    // Abschnitte, in denen auf beiden Seiten nichts fiel UND die hinter dem
    // dritten liegen, sind Verlängerung oder Penalty-Schießen, die nicht
    // gespielt wurden.
    if (i >= 3 && !home[i] && !guest[i]) continue;
    parts.push(`${home[i] ?? 0}:${guest[i] ?? 0}`);
  }
  return parts.join('   ·   ');
}

interface ScorerEntry {
  time: string;
  label: string;
}

/**
 * Pseudo-Trikotnummern aus dem Spielbericht. Sie stehen anstelle eines
 * Schützen, nicht für einen Spieler (Eigentor bzw. nicht angegeben). Ein
 * Namensnachschlag muss sie überspringen, sonst bekäme ein Tor mit der Nummer
 * 1000 einen beliebigen Spieler zugeschrieben.
 */
const PSEUDO_NUMBERS = [1000, 2000];

interface LineupPlayer {
  trikot_number?: number | string | null;
  player_firstname?: string | null;
  player_name?: string | null;
}

/**
 * Trikotnummer -> Spieler, je Mannschaft.
 *
 * DAS IST DER PUNKT, AN DEM DIESE KACHEL FAST STILL LEER GEBLIEBEN WÄRE:
 * `Game#formatted_events` liefert in `number` eine TRIKOTNUMMER und keinen
 * Namen. Aufgelöste Namen (`scorer_name`) hängt allein `OverlayPayload` an, und
 * der bedient die Overlays — nicht den Spielbericht, aus dem diese Kachel
 * gebaut wird. Wer hier nur `scorer_name` liest, bekommt keine Fehlermeldung,
 * sondern eine Kachel ohne Torschützenblock.
 *
 * Die Zuordnung läuft deshalb über `players` (die Aufstellung im Spielbericht),
 * genau wie serverseitig in OverlayPayload. `scorer_name` bleibt trotzdem die
 * erste Wahl, damit dieselbe Funktion auch mit einem Overlay-Datensatz
 * funktioniert.
 */
function rosterFor(game: Game, side: string): Map<number, LineupPlayer> {
  const players = (game.players ?? {}) as Record<string, LineupPlayer[]>;
  const map = new Map<number, LineupPlayer>();

  for (const player of players[side] ?? []) {
    // Ohne Trikotnummer aussortieren: `Number(null)` ergibt 0, und ein Tor mit
    // der Nummer 0 bekäme sonst einen beliebigen nummernlosen Spieler.
    if (
      player.trikot_number === null ||
      player.trikot_number === undefined ||
      player.trikot_number === ''
    ) {
      continue;
    }
    map.set(Number(player.trikot_number), player);
  }
  return map;
}

/** Vorname abgekürzt, wie in den Bauchbinden: „M. Mustermann". */
function displayName(player: LineupPlayer | undefined): string {
  if (!player) return '';

  const first = String(player.player_firstname ?? '').trim();
  const last = String(player.player_name ?? '').trim();
  if (!last) return first;
  if (!first) return last;
  return `${first[0]}. ${last}`;
}

function scorerEntries(game: Game): ScorerEntry[] {
  const events = (game.events ?? []) as {
    event_type?: string;
    event_team?: string;
    time?: string;
    number?: number | string | null;
    scorer_name?: string | null;
    goal_type_string?: string | null;
  }[];

  const rosters: Record<string, Map<number, LineupPlayer>> = {
    home: rosterFor(game, 'home'),
    guest: rosterFor(game, 'guest'),
  };

  return events
    .filter((event) => event.event_type === 'goal')
    .map((event) => {
      const side = String(event.event_team ?? '');
      const number = Number(event.number);
      const resolved =
        Number.isFinite(number) && !PSEUDO_NUMBERS.includes(number)
          ? rosters[side]?.get(number)
          : undefined;

      return {
        time: String(event.time ?? ''),
        // Ohne auflösbaren Schützen das Label aus dem Spielbericht (Eigentor,
        // nicht angegeben), sonst bliebe die Zeile leer.
        label:
          event.scorer_name?.trim() ||
          displayName(resolved) ||
          event.goal_type_string?.trim() ||
          'Tor',
      };
    });
}

/**
 * Zeichnet die Kachel und gibt sie als PNG-Blob zurück.
 *
 * Kein `null`-Rückgabewert bei fehlenden Daten: Ein Spiel ohne Ergebnis ergibt
 * eine Kachel mit „–:–", und das ist eine ehrlichere Auskunft als ein 0:0.
 */
export async function renderResultTile(
  input: ResultTileInput
): Promise<Blob | null> {
  const { game, format } = input;
  const { width, height } = SIZES[format];

  await ensureFonts();

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const [homeLogo, guestLogo] = await Promise.all([
    loadImage(game.home_team_logo ?? null),
    loadImage(game.guest_team_logo ?? null),
  ]);

  drawBackground(ctx, width, height);

  const centerX = width / 2;
  // Story hat mehr Höhe zu verteilen. Der Anfang liegt dort deutlich tiefer:
  // oben und unten legt Instagram eigene Bedienelemente über das Bild, und
  // mittig gesetzt bleibt die Kachel in beiden Fällen lesbar.
  let y = format === 'story' ? 430 : 130;

  centeredText(
    ctx,
    (game.league_name ?? '').toUpperCase(),
    centerX,
    y,
    `700 30px ${BODY_FONT}, sans-serif`,
    COLORS.accent
  );
  y += 60;

  if (game.date) {
    centeredText(
      ctx,
      germanDate(game.date),
      centerX,
      y,
      `400 30px ${BODY_FONT}, sans-serif`,
      COLORS.muted
    );
  }
  y += format === 'story' ? 140 : 100;

  // Platz für die Wappen nur reservieren, wenn es welche gibt. Sonst stünde bei
  // zwei Vereinen ohne hinterlegtes Logo ein leerer Streifen von 260 Pixeln
  // zwischen Datum und Ergebnis, und die Kachel sähe kaputt aus.
  const hasCrest = Boolean(homeLogo || guestLogo);
  const crestSize = hasCrest ? (format === 'story' ? 260 : 220) : 0;
  const crestOffset = format === 'story' ? 260 : 280;

  if (hasCrest) {
    drawCrest(
      ctx,
      homeLogo,
      centerX - crestOffset,
      y + crestSize / 2,
      crestSize
    );
    drawCrest(
      ctx,
      guestLogo,
      centerX + crestOffset,
      y + crestSize / 2,
      crestSize
    );
  }

  const score = game.result
    ? `${(game.result as { home_goals: number }).home_goals} : ${(game.result as { guest_goals: number }).guest_goals}`
    : '–:–';
  centeredText(
    ctx,
    score,
    centerX,
    y + crestSize / 2 + (hasCrest ? 40 : 120),
    `700 120px ${DISPLAY_FONT}, sans-serif`,
    COLORS.text
  );
  // Ohne Wappen muss der Abstand zu den Mannschaftsnamen von Hand kommen: Die
  // Ziffern sind 120 Pixel hoch, und ohne Luft darunter stiessen sie an die
  // Namen.
  y += crestSize + (hasCrest ? 90 : 250);

  const nameWidth = width - 120;
  const homeName = (game.home_team_name ?? '').toUpperCase();
  const guestName = (game.guest_team_name ?? '').toUpperCase();
  const nameFont = fitText(
    ctx,
    homeName.length > guestName.length ? homeName : guestName,
    nameWidth,
    (size) => `600 ${size}px ${DISPLAY_FONT}, sans-serif`,
    52,
    28
  );
  centeredText(ctx, homeName, centerX, y, nameFont, COLORS.text);
  y += 62;
  centeredText(ctx, guestName, centerX, y, nameFont, COLORS.text);
  y += 80;

  const periods = periodLine(game);
  if (periods) {
    centeredText(
      ctx,
      periods,
      centerX,
      y,
      `400 34px ${BODY_FONT}, sans-serif`,
      COLORS.muted
    );
    y += 80;
  }

  if (input.showScorers) {
    const entries = scorerEntries(game);
    if (entries.length) {
      centeredText(
        ctx,
        'TORE',
        centerX,
        y,
        `700 24px ${BODY_FONT}, sans-serif`,
        COLORS.accent
      );
      y += 50;

      // Nur so viele Zeilen, wie das Format trägt, und den Rest offen
      // benennen: Eine abgeschnittene Liste sähe nach einer vollständigen aus.
      const lineHeight = 44;
      const available = Math.floor((height - 120 - y) / lineHeight);
      const shown = entries.slice(0, Math.max(0, available - 1));

      shown.forEach((entry) => {
        centeredText(
          ctx,
          `${entry.time}   ${entry.label}`,
          centerX,
          y,
          `400 32px ${BODY_FONT}, sans-serif`,
          COLORS.text
        );
        y += lineHeight;
      });

      if (shown.length < entries.length) {
        centeredText(
          ctx,
          `und ${entries.length - shown.length} weitere`,
          centerX,
          y,
          `400 28px ${BODY_FONT}, sans-serif`,
          COLORS.muted
        );
      }
    }
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

/**
 * Spieltagsdatum als deutsches Datum.
 *
 * Nimmt `Date` UND `string`: Der Typ am Spiel sagt `Date`, die API liefert an
 * dieser Stelle aber einen Text (`game_days.date` ist eine String-Spalte). Wer
 * hier blind `Date`-Methoden aufruft, bekommt zur Laufzeit nichts davon zu
 * sehen und auf der Kachel „Invalid Date".
 */
function germanDate(value: Date | string): string {
  const iso =
    value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

/**
 * Ob der Liganame auf eine Jugendliga hindeutet.
 *
 * Grundlage der Voreinstellung für `showScorers`: Auf einer Kachel aus einer
 * Jugendliga stehen die Namen erst, wenn geklärt ist, dass sie dort stehen
 * dürfen.
 *
 * Über den Namen und nicht über ein Feld, weil der Spielabruf die Altersklasse
 * nicht mitliefert. Dieselbe Einschränkung wie beim Hinweis in der
 * Scorerliste: Eine umbenannte Liga rutscht durch, und die Erkennung ist
 * deshalb die Voreinstellung und nicht die Absicherung — entscheiden muss sie
 * die Person, die auf den Knopf drückt.
 */
export function looksLikeYouthLeague(
  leagueName: string | null | undefined
): boolean {
  const name = String(leagueName ?? '');
  return /\bU\s?\d{1,2}\b|junior|jugend|sch(ü|ue)ler|mini/i.test(name);
}

/**
 * Nur für Tests: Die Auflösung Trikotnummer -> Name ist der Teil, der still
 * kaputtgehen kann, und aus einem PNG lässt sich nicht zurücklesen, was darauf
 * steht.
 */
export function scorerEntriesForTest(
  game: Game
): { time: string; label: string }[] {
  return scorerEntries(game);
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
