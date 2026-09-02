/**
 * Thumbnail für YouTube im Bild des Wettbewerbs, gezeichnet auf eine Leinwand.
 *
 * WARUM EINE LEINWAND UND KEINE BROWSER-QUELLE: Die Overlays unter `overlay/`
 * liefern Flächen, die gesendet werden. Ein Thumbnail wird HOCHGELADEN, es muss
 * also eine Datei sein. Aus einer HTML-Fläche eine Datei zu machen, ginge nur
 * über eine Fremdbibliothek (html2canvas und Verwandte) oder über einen
 * serverseitigen Renderer; beides für zwei Bildaufbauten zu viel.
 *
 * WARUM DAS OHNE CORS-ÄRGER GEHT: Wappen und Ligazeichen liegen hinter
 * `/api/storage` (ActiveStorage mit `routes_prefix`), die mitgelieferten
 * Bildmarken unter `/overlay/img/` im eigenen Verzeichnis. In Produktion ist
 * das dieselbe Herkunft wie die Seite: `environment.prod.ts` zeigt auf
 * saisonmanager.de, und dort läuft auch die Oberfläche -- saisonmanager.org
 * leitet im nginx mit 301 dorthin um, ist also nie die Herkunft eines
 * geladenen Bildes. Die Leinwand wird damit nicht „tainted" und `toBlob` bleibt
 * erlaubt.
 *
 * `crossOrigin` steht trotzdem an jedem Bild, und es ist nicht entbehrlich: In
 * der Entwicklung laufen Frontend (4200) und API (3001) auf verschiedenen
 * Ports, und dort trägt allein die Freigabe in `cors.rb`.
 *
 * Format: 1280 × 720, das von YouTube empfohlene Maß. PNG, weil Wappen harte
 * Kanten haben; die Dateien liegen bei wenigen hundert Kilobyte und damit weit
 * unter der 2-MB-Grenze von YouTube.
 */

import { environment } from 'src/environments/environment';
import {
  CompetitionKey,
  OVERLAY_COLORS,
  competitionPalette,
} from './competition-theme';

export const THUMBNAIL_WIDTH = 1280;
export const THUMBNAIL_HEIGHT = 720;

/**
 * Wartezeit auf den Rückruf von `toBlob`. Kein Browser braucht für ein Bild
 * dieser Größe annähernd so lange; die Frist gibt es nur, damit ein
 * ausbleibender Rückruf als Fehler ankommt statt als ewiges Warten.
 */
const TO_BLOB_TIMEOUT_MS = 15000;

/**
 * Übergangszeitpunkt der Stinger aus `overlay/stinger/`, in Millisekunden.
 *
 * Der Wert gehört in OBS ins Feld „Übergangspunkt (ms)" und muss zur Datei
 * passen: Er liegt in der Mitte der gedeckten Phase, dort ist der Schnitt
 * verdeckt. Steht hier, weil ihn die Oberfläche nennt; erzeugt wird er von
 * `scripts/build-stinger.sh`, und wer die Zeitmarken dort ändert, ändert ihn
 * hier mit.
 */
export const STINGER_TRANSITION_POINT_MS = 500;

/**
 * Zwei Bildaufbauten, nicht mehr: Vor und während der Übertragung steht die
 * Paarung im Bild, danach das Ergebnis. Ein drittes „live" unterschiede sich
 * allein durch das Wort im Kennzeichen und wäre eine Wahl ohne Folgen.
 */
export type ThumbnailVariant = 'livestream' | 'highlights';

export const VARIANT_LABELS: Record<ThumbnailVariant, string> = {
  livestream: 'Livestream',
  highlights: 'Highlights',
};

export interface ThumbnailTeam {
  name: string;
  logoUrl?: string | null;
}

export interface ThumbnailInput {
  variant: ThumbnailVariant;
  competition: CompetitionKey;
  leagueName: string;
  /** Ligazeichen, siehe `leagueMarkUrl`. Ohne Zeichen bleibt die Fläche leer. */
  markUrl?: string | null;
  home: ThumbnailTeam;
  guest: ThumbnailTeam;
  /** Nur für `highlights`. Ohne Ergebnis fällt die Ausgabe auf die Paarung zurück. */
  score?: { home: number; guest: number; postfix?: string | null } | null;
  /** Erste Fußzeile, etwa „Sa. 12.10.2026 · 18:00 Uhr". */
  dateLine?: string | null;
  /** Zweite Fußzeile, die Halle. */
  venue?: string | null;
}

export interface ThumbnailResult {
  /**
   * Was im fertigen Bild FEHLT. Nicht „was nicht geladen hat": Ein Wappen, das
   * lädt, aber keine Maße hat (defekte Datei), wird ebenso durch das Kürzel
   * ersetzt, und auch das gehört benannt. Die Oberfläche sagt es dazu, statt es
   * zu verschweigen.
   */
  missing: ('home' | 'guest' | 'mark')[];
  /** Standen Oswald und Inter zur Verfügung? Sonst weicht das Bild von den Overlays ab. */
  fontsLoaded: boolean;
}

const DISPLAY_FAMILY = '"Oswald Thumbnail", Impact, "Arial Black", sans-serif';
const BODY_FAMILY =
  '"Inter Thumbnail", system-ui, -apple-system, "Segoe UI", sans-serif';

function display(size: number, weight = 700): string {
  return `${weight} ${size}px ${DISPLAY_FAMILY}`;
}

function body(size: number, weight = 400): string {
  return `${weight} ${size}px ${BODY_FAMILY}`;
}

let fontsPromise: Promise<boolean> | null = null;

/**
 * Lädt Oswald und Inter aus `overlay/fonts/` nach.
 *
 * Eine Leinwand zeichnet mit der Schrift, die IM MOMENT DES ZEICHNENS geladen
 * ist. Ohne dieses Warten steht im ersten Bild die Ersatzschrift, und weil das
 * Bild nur bei einer Änderung neu gebaut wird, bleibt es dabei.
 *
 * Schlägt das Laden fehl, wird trotzdem gezeichnet: Ein Thumbnail in Impact ist
 * unschöner als eines in Oswald, aber weit besser als keines. Deshalb wirft
 * diese Funktion nie -- sie gibt statt dessen zurück, ob die Schriften
 * tatsächlich da sind, damit die Oberfläche es sagen kann. Ein Bild in der
 * Ersatzschrift passt sichtbar nicht mehr zu den Overlays derselben
 * Übertragung, und das darf niemandem erst auf YouTube auffallen.
 *
 * Ein Fehlschlag wird NICHT zwischengespeichert: `fontsPromise` überlebt als
 * Modulvariable jede Navigation, ein einziges kurzes Netzproblem beim ersten
 * Aufruf hätte sonst die Ersatzschrift für die ganze Registerkarte
 * festgeschrieben.
 */
export function loadThumbnailFonts(): Promise<boolean> {
  if (fontsPromise) return fontsPromise;

  fontsPromise = (async () => {
    try {
      if (typeof FontFace === 'undefined' || !document.fonts) return false;

      const faces = [
        new FontFace(
          'Oswald Thumbnail',
          'url(/overlay/fonts/oswald-latin-var.woff2)',
          { weight: '400 700' }
        ),
        new FontFace(
          'Inter Thumbnail',
          'url(/overlay/fonts/inter-latin-var.woff2)',
          { weight: '100 900' }
        ),
      ];

      const loaded = await Promise.all(
        faces.map(async (face) => {
          try {
            document.fonts.add(await face.load());
            return true;
          } catch {
            // Einzelne Schrift nicht da: Der Rückfall in der Schriftliste greift.
            return false;
          }
        })
      );

      return loaded.every(Boolean);
    } catch {
      // Kein FontFace im Browser: derselbe Rückfall.
      return false;
    }
  })().then((ok) => {
    if (!ok) fontsPromise = null;
    return ok;
  });

  return fontsPromise;
}

/**
 * Vollständige Adresse eines Bildes.
 *
 * Drei Herkünfte, und sie müssen auseinandergehalten werden: Eine absolute
 * Adresse bleibt, wie sie ist. `/overlay/...` sind mitgelieferte Dateien des
 * Frontends und gehören an die Seite. Alles andere ist ein API-Pfad
 * (`/api/storage/...`), und der zeigt in der Entwicklung auf einen anderen Port
 * als die Seite.
 */
export function resolveMediaUrl(path?: string | null): string | null {
  if (!path) return null;

  try {
    if (/^(https?:|data:|blob:)/i.test(path)) return path;
    if (path.startsWith('/overlay/')) {
      return new URL(path, document.baseURI).href;
    }
    return new URL(path, environment.apiURL).href;
  } catch {
    return null;
  }
}

function loadImage(url?: string | null): Promise<HTMLImageElement | null> {
  const resolved = resolveMediaUrl(url);
  if (!resolved) return Promise.resolve(null);

  return new Promise((resolve) => {
    const img = new Image();
    // Für den Fall, dass Seite und Bild verschiedener Herkunft sind: ohne
    // dieses Attribut lädt das Bild zwar, verunreinigt aber die Leinwand, und
    // `toBlob` wirft danach SecurityError. Lieber hier scheitern, wo ein
    // Ersatzzeichen einspringt, als beim Herunterladen.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = resolved;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  // `roundRect` gibt es erst ab Chrome 99. OBS bringt ein eingebettetes
  // Chromium mit, dessen Fassung an der OBS-Version hängt -- hier zwar
  // unkritisch (das Thumbnail entsteht im Browser des Streamers), aber der
  // Pfad kostet drei Zeilen.
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function withLetterSpacing(
  ctx: CanvasRenderingContext2D,
  value: string,
  draw: () => void
): void {
  const supported = 'letterSpacing' in ctx;
  const previous = supported ? ctx.letterSpacing : '';

  if (supported) ctx.letterSpacing = value;
  draw();
  if (supported) ctx.letterSpacing = previous;
}

/** Kürzt auf die Breite und hängt ein Auslassungszeichen an. */
export function ellipsize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;

  let cut = text;
  while (cut.length > 1 && ctx.measureText(cut + '…').width > maxWidth) {
    cut = cut.slice(0, -1);
  }

  return cut + '…';
}

/**
 * Wortweiser Umbruch auf höchstens `maxLines` Zeilen. Was in die letzte Zeile
 * nicht mehr passt, wird dort gekürzt statt weggelassen: Ein stillschweigend
 * abgeschnittener Vereinsname ist eine falsche Angabe, ein Auslassungszeichen
 * eine sichtbare.
 *
 * Ein einzelnes Wort, das breiter ist als die Fläche, bleibt hier stehen, wie
 * es ist. Der Aufrufer misst nach und setzt dann kleiner.
 */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (let index = 0; index < words.length; index++) {
    const candidate = current ? `${current} ${words[index]}` : words[index];

    if (!current || ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }

    if (lines.length === maxLines - 1) {
      current = ellipsize(
        ctx,
        `${current} ${words.slice(index).join(' ')}`,
        maxWidth
      );
      break;
    }

    lines.push(current);
    current = words[index];
  }

  if (current) lines.push(current);

  return lines;
}

function fillCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  baseline: number
): void {
  const width = ctx.measureText(text).width;
  ctx.fillText(text, cx - width / 2, baseline);
}

const TEAM_NAME_SINGLE_SIZES = [46, 42, 38, 34, 32];
const TEAM_NAME_WRAP_SIZES = [38, 34, 30, 26];

/**
 * Mannschaftsname unter dem Wappen.
 *
 * Erst einzeilig, dann zweizeilig, dann gekürzt. Die Untergrenze von 32px für
 * eine Zeile ist keine Schönheitsfrage: Ein YouTube-Thumbnail steht in der
 * Übersicht gut 200 Pixel breit, und was hier kleiner gesetzt wird, ist dort
 * nicht mehr zu lesen. „SC DHfK Leipzig Floorball" und ähnlich lange Namen
 * gibt es reichlich.
 */
function drawTeamName(
  ctx: CanvasRenderingContext2D,
  name: string,
  cx: number,
  top: number,
  maxWidth: number
): void {
  const text = (name || '').trim().toUpperCase();
  if (!text) return;

  ctx.fillStyle = OVERLAY_COLORS.text;

  for (const size of TEAM_NAME_SINGLE_SIZES) {
    ctx.font = display(size);
    if (ctx.measureText(text).width <= maxWidth) {
      fillCentered(ctx, text, cx, top + size);
      return;
    }
  }

  for (const size of TEAM_NAME_WRAP_SIZES) {
    ctx.font = display(size);
    const lines = wrapText(ctx, text, maxWidth, 2);
    if (lines.every((line) => ctx.measureText(line).width <= maxWidth)) {
      lines.forEach((line, index) =>
        fillCentered(ctx, line, cx, top + size + index * size * 1.15)
      );
      return;
    }
  }

  ctx.font = display(26);
  fillCentered(ctx, ellipsize(ctx, text, maxWidth), cx, top + 26);
}

/** Kürzel aus dem Namen, wenn kein Wappen vorliegt. */
export function monogram(name: string): string {
  const words = (name || '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) return '?';

  return words
    .slice(0, 3)
    .map((word) => word[0].toUpperCase())
    .join('');
}

const CHIP_SIZE = 208;
const CHIP_RADIUS = 28;
const CHIP_PADDING = 22;
const CHIP_TOP = 226;
const CENTER_Y = CHIP_TOP + CHIP_SIZE / 2;
const HOME_CX = 286;
const GUEST_CX = 994;
const NAME_TOP = CHIP_TOP + CHIP_SIZE + 30;
const NAME_MAX_WIDTH = 430;
const PAD = 64;
/** Platz, den die Kopfzeile dem Kennzeichen oben rechts freihält. */
const BADGE_RESERVE = 300;

/**
 * Wappen auf hellem Feld.
 *
 * Hell und nicht dunkel, wie schon in der Anzeigetafel: Vereinswappen sind
 * überwiegend für weißen Grund gezeichnet, ein weißes Wappen auf dunklem Feld
 * verschwindet. Fehlt das Wappen, steht das Kürzel des Namens da statt einer
 * leeren Fläche.
 */
function drawCrest(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  name: string,
  cx: number,
  accent: string
): void {
  const x = cx - CHIP_SIZE / 2;

  ctx.save();
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, x, CHIP_TOP, CHIP_SIZE, CHIP_SIZE, CHIP_RADIUS);
  ctx.fill();
  ctx.restore();

  if (!img || !img.naturalWidth || !img.naturalHeight) {
    ctx.fillStyle = accent;
    ctx.font = display(72);
    const text = monogram(name);
    fillCentered(ctx, text, cx, CENTER_Y + 24);
    return;
  }

  // Einpassen statt füllen: Ein Wappen darf nicht beschnitten werden.
  const box = CHIP_SIZE - CHIP_PADDING * 2;
  const scale = Math.min(box / img.naturalWidth, box / img.naturalHeight);
  const width = img.naturalWidth * scale;
  const height = img.naturalHeight * scale;

  ctx.drawImage(img, cx - width / 2, CENTER_Y - height / 2, width, height);
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  accent: string,
  accentAlt: string
): void {
  const base = ctx.createLinearGradient(
    0,
    0,
    THUMBNAIL_WIDTH,
    THUMBNAIL_HEIGHT
  );
  base.addColorStop(0, OVERLAY_COLORS.primary);
  base.addColorStop(1, OVERLAY_COLORS.secondary);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);

  // Schein hinter der Paarung, damit die Mitte Tiefe bekommt und die Wappen
  // nicht auf einer flachen Fläche kleben.
  const glow = ctx.createRadialGradient(
    THUMBNAIL_WIDTH / 2,
    CENTER_Y,
    0,
    THUMBNAIL_WIDTH / 2,
    CENTER_Y,
    560
  );
  glow.addColorStop(0, hexWithAlpha(accent, 0.16));
  glow.addColorStop(1, hexWithAlpha(accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);

  // Akzentkante oben, dieselbe Geste wie in den Vollbildern der Bühne.
  const bar = ctx.createLinearGradient(0, 0, THUMBNAIL_WIDTH, 0);
  bar.addColorStop(0, accent);
  bar.addColorStop(1, accentAlt);
  ctx.fillStyle = bar;
  ctx.fillRect(0, 0, THUMBNAIL_WIDTH, 10);
}

/** `#rrggbb` mit Deckkraft. `color-mix` und `rgb()/` sind auf der Leinwand nicht überall da. */
export function hexWithAlpha(hex: string, alpha: number): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return hex;

  const value = parseInt(match[1], 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  leagueName: string,
  mark: HTMLImageElement | null
): number {
  const markHeight = 56;
  const markTop = 48;
  let textX = PAD;

  if (mark && mark.naturalWidth && mark.naturalHeight) {
    const width = (mark.naturalWidth / mark.naturalHeight) * markHeight;
    ctx.drawImage(mark, PAD, markTop, width, markHeight);
    textX = PAD + width + 26;
  }

  ctx.fillStyle = OVERLAY_COLORS.text;
  ctx.font = display(32, 600);
  const label = (leagueName || '').toUpperCase();
  // Der Platz endet vor dem Kennzeichen. Es wird danach gezeichnet und kennt
  // seine Breite selbst, deshalb hier ein fester Vorbehalt: „HIGHLIGHTS" ist das
  // längste Wort, das dort stehen kann, und misst mit Sperrung rund 260 Pixel.
  const available = THUMBNAIL_WIDTH - PAD - BADGE_RESERVE - textX;
  withLetterSpacing(ctx, '2px', () => {
    ctx.fillText(
      ellipsize(ctx, label, available),
      textX,
      markTop + markHeight / 2 + 12
    );
  });

  return markTop + markHeight;
}

function drawBadge(
  ctx: CanvasRenderingContext2D,
  label: string,
  accent: string,
  accentAlt: string
): void {
  const text = label.toUpperCase();
  const height = 50;
  const top = 50;

  ctx.font = display(28);
  const textWidth = ctx.measureText(text).width + 12; // Zuschlag für die Sperrung
  const width = textWidth + 52;
  const x = THUMBNAIL_WIDTH - PAD - width;

  const fill = ctx.createLinearGradient(x, top, x + width, top + height);
  fill.addColorStop(0, accent);
  fill.addColorStop(1, accentAlt);
  ctx.fillStyle = fill;
  roundRect(ctx, x, top, width, height, height / 2);
  ctx.fill();

  // Dunkle Schrift auf dem hellen Akzent: Die Akzenttöne sind für kleine
  // Versalien auf DUNKLEM Grund ausgelegt, umgekehrt trägt nur Dunkel auf Hell.
  ctx.fillStyle = OVERLAY_COLORS.primary;
  withLetterSpacing(ctx, '2px', () => {
    fillCentered(ctx, text, x + width / 2, top + height / 2 + 10);
  });
}

function drawCenter(
  ctx: CanvasRenderingContext2D,
  input: ThumbnailInput,
  accent: string
): void {
  const cx = THUMBNAIL_WIDTH / 2;
  const score = input.variant === 'highlights' ? input.score : null;

  if (score) {
    ctx.fillStyle = OVERLAY_COLORS.text;
    ctx.font = display(116);
    fillCentered(ctx, `${score.home}:${score.guest}`, cx, CENTER_Y + 40);

    if (score.postfix) {
      ctx.fillStyle = OVERLAY_COLORS.textMuted;
      ctx.font = body(26, 500);
      fillCentered(ctx, score.postfix, cx, CENTER_Y + 84);
    }
    return;
  }

  ctx.fillStyle = accent;
  ctx.font = display(84);
  withLetterSpacing(ctx, '4px', () => {
    fillCentered(ctx, 'VS', cx, CENTER_Y + 30);
  });
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  input: ThumbnailInput
): void {
  ctx.fillStyle = hexWithAlpha('#ffffff', 0.14);
  ctx.fillRect(PAD, 580, THUMBNAIL_WIDTH - PAD * 2, 2);

  // Rechts unten bleibt frei: Dort legt YouTube die Laufzeit über das Bild.
  const maxWidth = 900;

  if (input.dateLine) {
    ctx.fillStyle = OVERLAY_COLORS.text;
    ctx.font = body(30, 600);
    ctx.fillText(ellipsize(ctx, input.dateLine, maxWidth), PAD, 632);
  }

  if (input.venue) {
    ctx.fillStyle = OVERLAY_COLORS.textMuted;
    ctx.font = body(25);
    ctx.fillText(ellipsize(ctx, input.venue, maxWidth), PAD, 672);
  }
}

/** Trägt das Bild etwas bei? Ein geladenes Bild ohne Maße zeichnet nichts. */
function usable(img: HTMLImageElement | null): boolean {
  return Boolean(img && img.naturalWidth && img.naturalHeight);
}

/**
 * Zeichnet das Thumbnail in die übergebene Leinwand.
 *
 * Die Leinwand gehört dem Aufrufer: Sie steht als Vorschau in der Seite und ist
 * zugleich die Quelle des Downloads, damit beides nicht auseinanderlaufen kann.
 */
export async function renderStreamThumbnail(
  canvas: HTMLCanvasElement,
  input: ThumbnailInput
): Promise<ThumbnailResult> {
  canvas.width = THUMBNAIL_WIDTH;
  canvas.height = THUMBNAIL_HEIGHT;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Die Leinwand steht nicht zur Verfügung.');

  const fontsLoaded = await loadThumbnailFonts();

  const [homeLogo, guestLogo, mark] = await Promise.all([
    loadImage(input.home.logoUrl),
    loadImage(input.guest.logoUrl),
    loadImage(input.markUrl),
  ]);

  // Gefragt ist, was am Ende im BILD steht, nicht was der Abruf gemeldet hat:
  // `drawCrest` und `drawHeader` verwerfen ein Bild ohne Maße ebenfalls, und
  // eine defekte, aber ausgelieferte Datei kommt genau so an.
  const missing: ThumbnailResult['missing'] = [];
  if (input.home.logoUrl && !usable(homeLogo)) missing.push('home');
  if (input.guest.logoUrl && !usable(guestLogo)) missing.push('guest');
  if (input.markUrl && !usable(mark)) missing.push('mark');

  const { accent, accentAlt } = competitionPalette(input.competition);

  ctx.clearRect(0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
  ctx.textBaseline = 'alphabetic';

  drawBackground(ctx, accent, accentAlt);
  drawHeader(ctx, input.leagueName, mark);
  drawBadge(ctx, VARIANT_LABELS[input.variant], accent, accentAlt);

  drawCrest(ctx, homeLogo, input.home.name, HOME_CX, accent);
  drawCrest(ctx, guestLogo, input.guest.name, GUEST_CX, accent);
  drawTeamName(ctx, input.home.name, HOME_CX, NAME_TOP, NAME_MAX_WIDTH);
  drawTeamName(ctx, input.guest.name, GUEST_CX, NAME_TOP, NAME_MAX_WIDTH);

  drawCenter(ctx, input, accent);
  drawFooter(ctx, input);

  return { missing, fontsLoaded };
}

/** Dateiname des Downloads, aus Paarung und Bildaufbau. */
export function thumbnailFilename(
  input: Pick<ThumbnailInput, 'variant' | 'home' | 'guest'>
): string {
  const slug = (value: string) =>
    (value || '')
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);

  const parts = [
    'thumbnail',
    input.variant,
    slug(input.home.name),
    slug(input.guest.name),
  ].filter(Boolean);

  return `${parts.join('-')}.png`;
}

/**
 * Speichert die Leinwand als PNG.
 *
 * `toBlob` wirft bei einer verunreinigten Leinwand SecurityError. Das darf
 * nicht stumm bleiben: Wer nichts im Download-Ordner findet und keine Meldung
 * sieht, klickt weiter und hält am Ende die Funktion für kaputt.
 */
export function downloadThumbnail(
  canvas: HTMLCanvasElement,
  filename: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    let done = false;

    const fail = (error: unknown) => {
      if (done) return;
      done = true;
      window.clearTimeout(watchdog);
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    // Kommt der Rückruf gar nicht, bliebe das Versprechen für immer offen: Der
    // Aufrufer wartet dann mit `await`, sein `catch` greift nie, und es gibt
    // weder Datei noch Meldung. Genau der stille Fehlschlag, den die Meldung
    // unten verhindern soll.
    const watchdog = window.setTimeout(
      () => fail(new Error('Das Bild konnte nicht erzeugt werden.')),
      TO_BLOB_TIMEOUT_MS
    );

    try {
      canvas.toBlob((blob) => {
        if (done) return;

        if (!blob) {
          fail(new Error('Das Bild konnte nicht erzeugt werden.'));
          return;
        }

        // Ab hier ein eigener Riegel: Der äußere `try` deckt nur den
        // SYNCHRONEN Aufruf von `toBlob` ab. Wirft eine dieser Zeilen
        // (`createObjectURL` in einem eingeschränkten Kontext, ein `removeChild`
        // auf einem inzwischen entfernten Knoten), wäre das Versprechen sonst
        // nie erfüllt worden.
        try {
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = filename;
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          // Erst freigeben, wenn der Browser den Download angenommen hat.
          window.setTimeout(() => URL.revokeObjectURL(url), 1000);

          done = true;
          window.clearTimeout(watchdog);
          resolve();
        } catch (error) {
          fail(error);
        }
      }, 'image/png');
    } catch (error) {
      fail(error);
    }
  });
}
