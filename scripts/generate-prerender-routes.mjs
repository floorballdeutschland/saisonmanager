/**
 * Generiert `prerender-routes.txt` für das Prerendering (SSG) der öffentlichen
 * Seiten: alle Ligen eines Spielbetriebs in der laufenden Saison.
 *
 * Aufruf (aus build-deploy.sh, vor `ng build`):
 *   FRONTEND_API_KEY=<key> node scripts/generate-prerender-routes.mjs
 *
 * Optionale Env-Variablen: API_URL, PRERENDER_GO_PATH (Vorgabewert siehe unten).
 *
 * Der Slug muss dem Feld `path` aus `init.json` entsprechen, also
 * `GameOperation#slug`: die Spalte `game_operations.path`, oder bei leerer
 * Spalte `short_name.parameterize`. Er ist das erste Segment der öffentlichen
 * Adresse (`/<path>/<league_id>`).
 *
 * Er stand hier auf `fvd`, dem Segment des Altsystems (siehe `LegacyImport::Vocab`
 * und die v1-Ticker-Route in `api_controller.rb`). Floorball Deutschland liegt
 * heute unter `fd`, und beim Prod-Deploy von 1.102.1 fiel auf, dass der Lauf
 * deshalb still die eingecheckte Liste behielt: vorgerendert wurden Seiten unter
 * `/fvd/...`, die keine Liga auflösen, während die echten Adressen unter `/fd/...`
 * ungerendert blieben.
 *
 * Drei Fehlerarten, drei Reaktionen -- die Asymmetrie ist am Code nicht ablesbar:
 *
 *   Vorübergehend (API nicht erreichbar, 5xx, kaputtes JSON) → Warnung, die
 *   eingecheckte Liste bleibt stehen, der Build läuft weiter. Ein Deploy soll
 *   nicht scheitern, weil die API gerade neu startet.
 *
 *   Übergangszustand (keine Ligen in der laufenden Saison, etwa direkt nach dem
 *   Saisonwechsel) → ebenfalls Warnung und Liste behalten, aber ausdrücklich
 *   NICHT schreiben. Die API antwortet hier mit 200 und `[]`, nicht mit 404
 *   (`leagues.season_id` ist varchar), ein Durchlauf würde die brauchbare Liste
 *   also durch zwei Zeilen ersetzen und dabei Erfolg melden.
 *
 *   Falsche Konfiguration (Slug fehlt in einer gefüllten Liste, Key abgelehnt)
 *   → Abbruch. `build-deploy.sh` hat `set -e`, der Deploy endet damit vor dem
 *   `scp`. Nur hier ist die eingecheckte Liste garantiert falsch.
 *
 * Läuft ausschließlich aus `build-deploy.sh`; CI und build-deploy-staging.sh
 * rufen das Skript nicht auf. Ein falscher Slug kann deshalb nur beim
 * Prod-Deploy auffallen.
 */
import { renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const API_URL = (
  process.env.API_URL ?? "https://saisonmanager.de/api/v2/"
).replace(/\/?$/, "/");
const GO_PATH = process.env.PRERENDER_GO_PATH ?? "fd";
const API_KEY = process.env.FRONTEND_API_KEY ?? "";
// Am Skript festgemacht und nicht an `process.cwd()`: Aus einem anderen
// Verzeichnis aufgerufen schrieb das Skript sonst eine Datei ins Leere und
// meldete Erfolg, waehrend der Build die alte Liste aus der Workspace-Wurzel
// nahm (`routesFile` in angular.json ist relativ zu ihr).
const OUT_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "prerender-routes.txt"
);

const headers = API_KEY ? { "X-Api-Key": API_KEY } : {};

/** Abbruchgrund, der sich nicht von selbst behebt (siehe Kopf). */
class ConfigError extends Error {}

async function getJson(path) {
  const res = await fetch(API_URL + path, { headers });
  if (!res.ok) {
    // 401/403 heisst: der Key fehlt oder wurde zurueckgezogen. Das behebt sich
    // nicht von selbst, und der folgende Prerender-Build stirbt ohnehin an
    // `API key required` -- dann besser hier mit der klaren Ursache.
    if (res.status === 401 || res.status === 403) {
      throw new ConfigError(
        `GET ${path} -> HTTP ${res.status}. API-Key fehlt oder wird abgelehnt ` +
          `(src/environments/.api-key gegen /verwaltung/api-keys pruefen).`
      );
    }
    throw new Error(`GET ${path} -> HTTP ${res.status}`);
  }
  return res.json();
}

try {
  const init = await getJson("init.json");
  // Ungepruefte Uebernahme setzte sonst wortwoertlich `undefined` in die URL der
  // Ligenabfrage, und die antwortet darauf mit 200 und `[]` statt mit 404.
  const seasonId = init.current_season_id;
  if (seasonId === undefined || seasonId === null || seasonId === "") {
    throw new Error("init.json enthaelt kein current_season_id");
  }
  const spielbetriebe = Array.isArray(init.game_operations)
    ? init.game_operations
    : [];
  const vorhandeneSlugs = spielbetriebe.map((g) => g.path).filter(Boolean);
  const operation = spielbetriebe.find((g) => g.path === GO_PATH);
  if (!operation) {
    // Eine leere oder fehlende Liste ist NICHT derselbe Fall wie ein falscher
    // Slug: Die eingecheckte Liste ist dann brauchbar, und die Ursache liegt bei
    // der Antwort (kalter Cache, abgeschnittene Nutzlast, umbenanntes Feld).
    // Ohne diese Unterscheidung braeche eine einmal degradierte init-Antwort den
    // ganzen Prod-Deploy ab -- schlechter als der Zustand, den dieser Lauf
    // beheben soll.
    if (!vorhandeneSlugs.length) {
      throw new Error(
        "init.json enthaelt keine Spielbetriebe (game_operations leer oder fehlend)"
      );
    }
    // Die vorhandenen Slugs mitgeben: Der Unterschied zwischen `fd` und `fvd`
    // ist an einer nackten Fehlermeldung nicht zu erkennen.
    throw new ConfigError(
      `Spielbetrieb mit path="${GO_PATH}" nicht gefunden. ` +
        `Vorhanden: ${vorhandeneSlugs.join(", ")}`
    );
  }

  const leagues = await getJson(
    `game_operations/${operation.id}/leagues/${seasonId}.json`
  );
  // Der Uebergangszustand aus dem Kopf: 200 mit `[]`. Eine Liste aus zwei Zeilen
  // waere kein Ergebnis, sondern der Verlust des Rueckfalls -- mit
  // Erfolgsmeldung im Protokoll.
  if (!Array.isArray(leagues) || leagues.length === 0) {
    throw new Error(
      `Spielbetrieb "${GO_PATH}" hat in Saison ${seasonId} keine Ligen`
    );
  }

  const routes = ["/", `/${GO_PATH}`];
  for (const league of leagues) {
    const base = `/${GO_PATH}/${league.id}`;
    routes.push(base); // Übersicht (enthält Spielplan + Tabelle)
    if (league.league_type !== "cup") {
      routes.push(`${base}/tabelle`);
    }
    routes.push(`${base}/scorer`);
  }

  // Ueber eine Zwischendatei: `writeFileSync` kuerzt zuerst auf 0. Bricht das
  // Schreiben danach ab (volle Platte, Quota), stand ein Torso in der Datei --
  // waehrend der catch unten behauptete, die vorhandene Liste bleibe erhalten.
  const tmpFile = `${OUT_FILE}.tmp`;
  writeFileSync(tmpFile, routes.join("\n") + "\n", "utf-8");
  renameSync(tmpFile, OUT_FILE);
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
