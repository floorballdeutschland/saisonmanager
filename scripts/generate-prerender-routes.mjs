/**
 * Generiert `prerender-routes.txt` für das Prerendering (SSG) der öffentlichen
 * Seiten. Aktueller Scope: die national betriebenen Ligen von Floorball
 * Deutschland (Spielbetrieb `fvd`) der laufenden Saison – das sind 1. FBL,
 * 2. FBL, FD-Pokal sowie die weiteren FD-Wettbewerbe.
 *
 * Aufruf (z. B. aus build-deploy.sh, vor `ng build`):
 *   FRONTEND_API_KEY=<key> node scripts/generate-prerender-routes.mjs
 *
 * Optionale Env-Variablen:
 *   API_URL          – Basis-URL der API (Default: Prod)
 *   PRERENDER_GO_PATH – Spielbetrieb-Slug (Default: fvd)
 *
 * Schlägt ein API-Aufruf fehl, wird die vorhandene (eingecheckte)
 * `prerender-routes.txt` NICHT überschrieben – der Build bleibt robust.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const API_URL = (
  process.env.API_URL ?? "https://saisonmanager.org/api/v2/"
).replace(/\/?$/, "/");
const GO_PATH = process.env.PRERENDER_GO_PATH ?? "fvd";
const API_KEY = process.env.FRONTEND_API_KEY ?? "";
const OUT_FILE = join(process.cwd(), "prerender-routes.txt");

const headers = API_KEY ? { "X-Api-Key": API_KEY } : {};

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
    throw new Error(`Spielbetrieb mit path="${GO_PATH}" nicht gefunden`);
  }

  const leagues = await getJson(
    `game_operations/${operation.id}/leagues/${seasonId}.json`
  );

  const routes = ["/"];
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
  console.warn(
    `[generate-prerender-routes] WARNUNG: ${err.message}. ` +
      `Bestehende prerender-routes.txt wird beibehalten.`
  );
}
