import { ErrorHandler } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import * as Sentry from '@sentry/angular';
import {
  ChunkRecoveryEnv,
  isChunkLoadError,
  recoverFromChunkLoadError,
  safeSessionStorage,
} from './chunk-load-recovery';

/**
 * HTTP-Antwortstatus, die nichts über den Code aussagen.
 *
 * `0` heißt: Die Anfrage kam nie an oder wurde abgebrochen – Funkloch, Wechsel
 * des Netzes, oder die Seite wurde während des Ladens verlassen. `401` ist der
 * erwartbare Zustand „nicht angemeldet", den vor allem Suchmaschinen auslösen.
 *
 * Bei `401` meldet der ErrorInterceptor ab, bei `0` zeigt er einen Hinweis. Was
 * hier ankommt, ist die Dublette dazu: Komponenten ohne eigenen `error`-Zweig
 * lassen den Fehler zusätzlich in Angulars ErrorHandler laufen.
 *
 * Eine Ausnahme kennt der Hinweis seit fe#489: Anfragen, die eine Ansicht im
 * Takt nachlädt (SILENT_REFRESH), zeigen bei `0` nichts mehr an. Diese Fälle
 * sind damit nirgends sichtbar, und das ist Absicht. Status 0 entsteht bei
 * jedem gesperrten Bildschirm und jedem Netzwechsel, eine Meldung je Vorfall
 * ergäbe im Monitoring eine Flut ohne Aussage. Ein echter Ausfall fällt
 * anders auf: Die Anfragen der Oberfläche selbst schlagen dann ebenfalls fehl,
 * und die melden weiter.
 *
 * Bewusst NICHT gefiltert: 404 und die übrigen 4xx sowie 5xx. Ein 404 kann eine
 * falsche Annahme im Frontend sein, und ein 502 sieht nur der Browser – die API
 * meldet ihn nicht selbst, weil sie ihn gar nicht erzeugt hat.
 */
const IGNORED_HTTP_STATUS = [0, 401];

/**
 * Packt die Ausnahme aus, die Angular über zone.js eingewickelt hat.
 *
 * Ohne das Auspacken greift die Statusprüfung unten nur zufällig: Was in
 * `handleError` ankommt, ist je nach Aufrufweg der Fehler selbst oder ein
 * Wrapper mit `ngOriginalError`. Sentrys eigener Handler macht dasselbe
 * (`tryToUnwrapZonejsError`).
 */
function unwrap(error: unknown): unknown {
  const wrapped = error as { ngOriginalError?: unknown } | null;
  return wrapped?.ngOriginalError ?? error;
}

/** Bereits behandelter Netz- oder Anmeldezustand, also keine Meldung wert. */
export function isHandledHttpNoise(error: unknown): boolean {
  const original = unwrap(error);
  return (
    original instanceof HttpErrorResponse &&
    IGNORED_HTTP_STATUS.includes(original.status)
  );
}

/**
 * Sentrys ErrorHandler mit einem Filter davor.
 *
 * Der Filter MUSS hier sitzen und nicht in `beforeSend`: Sentrys Handler ruft
 * `captureException` nicht mit der Ausnahme auf, sondern mit dem Ergebnis
 * seines Extractors. Bei einer `HttpErrorResponse` ist das eine
 * Zeichenkette (`Http failure response for <url>: 0 Unknown Error`), das
 * ursprüngliche Objekt ist in `beforeSend` also gar nicht mehr vorhanden – ein
 * `instanceof`-Test dort ist toter Code. Genau so war fe#239 gebaut, und die
 * Meldungen liefen unverändert weiter.
 *
 * Ein Test, der `beforeSend` eine selbst gebaute `HttpErrorResponse` reicht,
 * bestätigt dabei nur die eigene Annahme über das SDK. Deshalb prüft der Test
 * zu dieser Klasse, ob der echte Sentry-Handler aufgerufen wird oder nicht.
 *
 * Zusätzlich die Stelle, an der ein fehlgeschlagenes Nachladen eines
 * Programmteils die Seite neu lädt (siehe chunk-load-recovery.ts). Das gehört
 * hierher und nicht in den Router: Ein solcher Fehler entsteht nicht nur beim
 * Wechsel in einen noch nicht geladenen Bereich, sondern auch bei jedem
 * `import()` innerhalb einer Komponente, und beide Wege enden hier.
 */
export class FilteringErrorHandler implements ErrorHandler {
  private readonly delegate: ErrorHandler;
  private readonly recovery: ChunkRecoveryEnv;

  constructor(
    delegate: ErrorHandler = Sentry.createErrorHandler({ showDialog: false }),
    recovery: ChunkRecoveryEnv = {
      now: () => Date.now(),
      storage: safeSessionStorage(),
      // `navigator.onLine` ist in jedem unterstuetzten Browser vorhanden; der
      // Rueckfall auf true haelt das Verhalten dort unveraendert, wo es fehlt.
      online: () => navigator.onLine ?? true,
      reload: () => window.location.reload(),
    }
  ) {
    this.delegate = delegate;
    this.recovery = recovery;
  }

  handleError(error: unknown): void {
    if (isHandledHttpNoise(error)) return;

    // Ein Chunk-Ladefehler, den das Neuladen behebt, wird NICHT gemeldet.
    //
    // Früher wurde jeder gemeldet, als Hinweis auf ein schiefgegangenes Deploy.
    // In der Praxis lagen die Dateien aber fast immer auf dem Server (`scp`
    // löscht nichts): Es waren Ladeabbrüche in iOS-WebViews, Apple Mail und
    // Safari nach dem Aufwachen, über 1000 Meldungen in vier Tagen
    // (SAISONMANAGER-2B), die das Sentry-Kontingent aufbrauchten.
    //
    // Der Hinweis auf ein kaputtes Deploy bleibt trotzdem erhalten: Fehlt die
    // Datei wirklich, scheitert der Tab nach dem Neuladen erneut, und dann ist
    // das Fenster gegen Endlosschleifen noch zu – `recoverFromChunkLoadError`
    // lädt nicht neu, und dieser zweite Fehler wird gemeldet. Ebenso jeder
    // Fall, in dem gar nicht neu geladen wird (offline, kein Speicher).
    if (isChunkLoadError(error) && recoverFromChunkLoadError(this.recovery)) {
      return;
    }

    this.delegate.handleError(error);
  }
}
