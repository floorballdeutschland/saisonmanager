import { HttpContext, HttpContextToken } from '@angular/common/http';

/**
 * Markiert eine Anfrage als Hintergrund-Aktualisierung.
 *
 * Die öffentlichen Ansichten laden sich alle 30 Sekunden selbst nach, ohne dass
 * jemand etwas angeklickt hätte. Ein Aussetzer dabei ist kein Vorgang, über den
 * die Zuschauerin etwas erfahren muss: Die Liste steht weiter, der nächste Takt
 * holt den Stand nach. Der ErrorInterceptor schweigt deshalb zu Transport- und
 * Serverfehlern solcher Anfragen. Alles, was an einer Entscheidung des
 * Benutzers hängt (401, 403, 404, Validierungen), meldet er unverändert.
 */
export const SILENT_REFRESH = new HttpContextToken<boolean>(() => false);

/**
 * Kontext für einen Abruf, der wahlweise im Vordergrund oder im Hintergrund
 * läuft. Dieselbe Service-Methode bedient beide Fälle: Der erste Aufruf einer
 * Ansicht soll einen Fehler melden, das Nachladen im Takt nicht.
 */
export function refreshContext(silent: boolean): HttpContext {
  return new HttpContext().set(SILENT_REFRESH, silent);
}
