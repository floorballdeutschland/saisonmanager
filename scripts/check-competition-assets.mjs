/**
 * Prüft, dass die drei Stellen, an denen ein Wettbewerb beschrieben ist, noch
 * dasselbe sagen:
 *
 *   1. `src/app/_helpers/_utils/competition-theme.ts` -- Farben und Schlüssel
 *      für Thumbnail und Übergangsgrafik (Angular),
 *   2. `overlay/overlay.css` -- dieselben Farben für die Bühne (Vanilla, außerhalb
 *      des Angular-Builds und deshalb nicht importierbar),
 *   3. `overlay/stinger/<key>.webm` -- die fertige Übergangsgrafik je Schlüssel.
 *
 * Ohne diese Prüfung fällt eine Abweichung erst auf Sendung auf: ein Thumbnail in
 * den Farben einer anderen Liga als die Anzeigetafel derselben Übertragung, oder
 * ein Download, der auf eine Datei zeigt, die es nicht gibt. Beides bleibt in
 * Lint, Tests und Build unsichtbar -- Karma liefert `overlay/` gar nicht aus, und
 * die CSS-Datei wird nur kopiert.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];

const theme = readFileSync(
  join(root, 'src/app/_helpers/_utils/competition-theme.ts'),
  'utf8'
);
const css = readFileSync(join(root, 'overlay/overlay.css'), 'utf8');

/** Schlüssel und Akzentfarbe aus dem PALETTES-Block. */
function paletteFromTheme() {
  const block = theme.match(
    /const PALETTES: Record<CompetitionKey, CompetitionPalette> = \{([\s\S]*?)\n\};/
  );
  if (!block) {
    problems.push('competition-theme.ts: PALETTES nicht gefunden');
    return new Map();
  }

  const entries = new Map();
  const line = /^\s*'?([\w-]+)'?:\s*\{\s*accent:\s*'(#[0-9a-f]{6})'/gim;
  let match;
  while ((match = line.exec(block[1])) !== null) {
    entries.set(match[1], match[2].toLowerCase());
  }

  return entries;
}

/**
 * Akzentfarbe je Wettbewerb aus der CSS. Ein Block kann mehrere Schlüssel
 * tragen (`1fbl-w` und `damen` teilen sich die Farbwelt der 1. Damen), und wer
 * keinen eigenen Block hat, erbt den Wert aus `:root`.
 */
function paletteFromCss() {
  const base = css.match(/:root\s*\{[\s\S]*?--ov-accent:\s*(#[0-9a-f]{6})/i);
  const entries = new Map();

  const block = /:root\[data-competition="([^"]+)"\](?:,\s*\n?:root\[data-competition="([^"]+)"\])?\s*\{[\s\S]*?--ov-accent:\s*(#[0-9a-f]{6})/gi;
  let match;
  while ((match = block.exec(css)) !== null) {
    const accent = match[3].toLowerCase();
    entries.set(match[1], accent);
    if (match[2]) entries.set(match[2], accent);
  }

  return { entries, base: base ? base[1].toLowerCase() : null };
}

const themePalette = paletteFromTheme();
const { entries: cssPalette, base: cssBase } = paletteFromCss();

if (themePalette.size === 0) {
  problems.push('competition-theme.ts: keine Wettbewerbe gelesen');
}

for (const [key, accent] of themePalette) {
  const expected = cssPalette.get(key) ?? cssBase;

  if (!expected) {
    problems.push(`overlay.css: kein Akzent für "${key}" und kein :root-Wert`);
  } else if (expected !== accent) {
    problems.push(
      `Akzent von "${key}" weicht ab: competition-theme.ts ${accent}, overlay.css ${expected}`
    );
  }
}

const stingers = new Set(
  readdirSync(join(root, 'overlay/stinger'))
    .filter((name) => name.endsWith('.webm'))
    .map((name) => name.replace(/\.webm$/, ''))
);

for (const key of themePalette.keys()) {
  if (!stingers.has(key)) {
    problems.push(
      `overlay/stinger/${key}.webm fehlt (scripts/build-stinger.sh ausführen)`
    );
  }
}

for (const key of stingers) {
  if (!themePalette.has(key)) {
    problems.push(
      `overlay/stinger/${key}.webm gehört zu keinem Wettbewerb aus competition-theme.ts`
    );
  }
}

if (problems.length > 0) {
  console.error('Wettbewerbe stimmen nicht überein:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(
  `Wettbewerbe geprüft: ${themePalette.size} Schlüssel, Farben und Übergangsgrafiken stimmen überein.`
);
