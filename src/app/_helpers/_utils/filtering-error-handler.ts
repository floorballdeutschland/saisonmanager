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
 * Beide erzeugen bereits eine sichtbare Meldung: Der ErrorInterceptor behandelt
 * `0` mit einem eigenen Hinweis und meldet bei `401` ab. Was hier ankommt, ist
 * die Dublette dazu – Komponenten ohne eigenen `error`-Zweig lassen den Fehler
 * zusätzlich in Angulars ErrorHandler laufen.
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
      reload: () => window.location.reload(),
    }
  ) {
    this.delegate = delegate;
    this.recovery = recovery;
  }

  handleError(error: unknown): void {
    if (isHandledHttpNoise(error)) return;

    // Erst melden, dann neu laden – nicht umgekehrt. Das Neuladen bricht
    // laufende Anfragen ab, und ein Chunk-Ladefehler ist der wichtigste
    // Hinweis auf ein schiefgegangenes Deploy (Begründung in sentry-init.ts).
    // Ginge er dabei verloren, tauschte der Fix eine weiße Seite gegen einen
    // blinden Fleck im Monitoring.
    this.delegate.handleError(error);

    if (isChunkLoadError(error)) {
      recoverFromChunkLoadError(this.recovery);
    }
  }
}
