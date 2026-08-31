/**
 * Generiert `prerender-routes.txt` für das Prerendering (SSG) der öffentlichen
 * Seiten. Aktueller Scope: die national betriebenen Ligen von Floorball
 * Deutschland (Spielbetrieb `fd`) der laufenden Saison – das sind 1. FBL,
 * 2. FBL, FD-Pokal sowie die weiteren FD-Wettbewerbe.
 *
 * Aufruf (z. B. aus build-deploy.sh, vor `ng build`):
 *   FRONTEND_API_KEY=<key> node scripts/generate-prerender-routes.mjs
 *
 * Optionale Env-Variablen:
 *   API_URL          – Basis-URL der API (Default: Prod)
 *   PRERENDER_GO_PATH – Spielbetrieb-Slug (Default: fd)
 *
 * Der Slug muss der Spalte `game_operations.path` entsprechen, denn er ist das
 * erste Segment der öffentlichen Adresse (`/<path>/<league_id>`). Er stand hier
 * bis fe#362 auf `fvd`, einen Spielbetrieb dieses Namens gibt es aber nicht:
 * Floorball Deutschland liegt unter `fd`. Der Lauf schlug damit seit der
 * Einführung des Prerenderings (fe#10) bei JEDEM Build fehl, behielt still die
 * eingecheckte Liste und rendert Seiten unter `/fvd/...` vor, die keine Liga
 * auflösen und deshalb leer bleiben – während die echten Adressen unter `/fd/...`
 * ungerendert blieben.
 *
 * Zwei Fehlerarten, zwei Reaktionen:
 *
 *   Vorübergehend (API nicht erreichbar, HTTP-Fehler) → Warnung, die
 *   eingecheckte `prerender-routes.txt` bleibt stehen, der Build läuft weiter.
 *   Ein Deploy soll nicht daran scheitern, dass die API gerade neu startet.
 *
 *   Falsche Konfiguration (Slug gibt es nicht) → Abbruch. Das ist kein
 *   vorübergehender Zustand, es behebt sich nicht von selbst, und die
 *   eingecheckte Liste ist dann garantiert falsch. Genau dieser Fall lief zwei
 *   Monate unbemerkt, weil er nur gewarnt hat.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const API_URL = (
  process.env.API_URL ?? "https://saisonmanager.de/api/v2/"
).replace(/\/?$/, "/");
const GO_PATH = process.env.PRERENDER_GO_PATH ?? "fd";
const API_KEY = process.env.FRONTEND_API_KEY ?? "";
const OUT_FILE = join(process.cwd(), "prerender-routes.txt");

const headers = API_KEY ? { "X-Api-Key": API_KEY } : {};

/** Abbruchgrund, der sich nicht von selbst behebt (siehe Kopf). */
class ConfigError extends Error {}

async function getJson(path) {
  const res = await fetch(API_URL + path, { headers });
  if (!res.ok) {
    throw new Error(`GET ${path} -> HTTP ${res.status}`);
  }
  return res.json();
}

try {
  const init = await getJson("init.json");
  const seasonId = init.current_season_id;
  const operation = (init.game_operations ?? []).find(
    (g) => g.path === GO_PATH
  );
  if (!operation) {
    // Die vorhandenen Slugs mitgeben: Der Unterschied zwischen `fd` und `fvd`
    // ist an einer nackten Fehlermeldung nicht zu erkennen.
    const vorhanden = (init.game_operations ?? [])
      .map((g) => g.path)
      .filter(Boolean)
      .join(", ");
    throw new ConfigError(
      `Spielbetrieb mit path="${GO_PATH}" nicht gefunden. Vorhanden: ${vorhanden}`
    );
  }

  const leagues = await getJson(
    `game_operations/${operation.id}/leagues/${seasonId}.json`
  );

  const routes = ["/", `/${GO_PATH}`];
  for (const league of leagues) {
    const base = `/${GO_PATH}/${league.id}`;
    routes.push(base); // Übersicht (enthält Spielplan + Tabelle)
    if (league.league_type !== "cup") {
      routes.push(`${base}/tabelle`);
    }
    routes.push(`${base}/scorer`);
  }

  writeFileSync(OUT_FILE, routes.join("\n") + "\n", "utf-8");
  console.log(
    `prerender-routes.txt geschrieben: ${routes.length} Routen ` +
      `(${leagues.length} ${GO_PATH}-Ligen, Saison ${seasonId}).`
  );
} catch (err) {
  if (err instanceof ConfigError) {
    console.error(`[generate-prerender-routes] FEHLER: ${err.message}`);
    process.exit(1);
  }
  console.warn(
    `[generate-prerender-routes] WARNUNG: ${err.message}. ` +
      `Bestehende prerender-routes.txt wird beibehalten.`
  );
}
