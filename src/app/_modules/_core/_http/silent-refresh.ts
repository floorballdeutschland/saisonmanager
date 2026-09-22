import { HttpContext, HttpContextToken } from '@angular/common/http';

/**
 * Markiert eine Anfrage als Hintergrund-Aktualisierung.
 *
 * Die öffentlichen Ansichten laden sich in kurzem Takt selbst nach, ohne dass
 * jemand etwas angeklickt hätte. Ein Aussetzer dabei ist kein Vorgang, über den
 * die Zuschauerin etwas erfahren muss: Die Ansicht behält ihren Stand, der
 * nächste Takt holt ihn nach.
 *
 * Der ErrorInterceptor schweigt für solche Anfragen zu genau drei Fällen:
 * Status 0 (Transport), 5xx (Server) und der unlesbaren 2xx-Antwort. Alles, was
 * an einer Entscheidung des Benutzers hängt (401, 403, 404, Validierungen),
 * meldet er unverändert. In der Konsole landet der unlesbare Fall weiterhin,
 * still ist nur die Meldung auf dem Bildschirm.
 */
export const SILENT_REFRESH = new HttpContextToken<boolean>(() => false);

/**
 * Kontext für einen Abruf, der wahlweise im Vordergrund oder im Hintergrund
 * läuft. Dieselbe Service-Methode bedient beide Fälle; welcher es ist,
 * entscheidet die Ansicht: Was an einer Handlung des Benutzers hängt, meldet
 * einen Fehlschlag, ein reiner Takt nicht.
 */
export function refreshContext(silent: boolean): HttpContext {
  return new HttpContext().set(SILENT_REFRESH, silent);
}
