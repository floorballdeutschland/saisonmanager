import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpContext,
  HttpContextToken,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError, timer } from 'rxjs';
import { finalize, map, retry, shareReplay } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

/**
 * Markiert den Abruf, der die Sitzung holt. Der PublicSessionInterceptor
 * lässt ihn durch, sonst könnte ein abgewiesenes Holen sich selbst erneut
 * anstoßen.
 */
export const SKIP_PUBLIC_SESSION = new HttpContextToken<boolean>(() => false);

/**
 * Wie oft und wie lange das Holen bei einem 429 still wiederholt wird. Die API
 * begrenzt neue Sitzungen je Adresse und Minute; in einer vollen Halle hängen
 * alle Zuschauer hinter einer IP. Fünf Versuche decken auch einen Anpfiff ab,
 * zu dem über tausend Geräte zugleich zum ersten Mal kommen.
 */
export const PUBLIC_SESSION_MAX_RETRIES = 5;
const MAX_WAIT_MS = 60_000;
const FALLBACK_WAIT_MS = 30_000;

/**
 * Streuung auf die Wartezeit. Ohne sie liefen alle abgewiesenen Geräte genau
 * zum Beginn des nächsten Zählfensters wieder los und stießen erneut zusammen.
 */
const JITTER_MS = 10_000;

/** Wartezeit vor dem nächsten Versuch, aus `Retry-After` (Sekunden). */
export function publicSessionRetryDelay(
  err: HttpErrorResponse,
  random: () => number = Math.random
): number {
  const seconds = Number(err.headers?.get('Retry-After'));
  const base =
    Number.isFinite(seconds) && seconds > 0
      ? Math.min(seconds * 1000, MAX_WAIT_MS)
      : FALLBACK_WAIT_MS;
  return base + Math.floor(random() * JITTER_MS);
}

/**
 * Anonyme Sitzung der Website gegenüber der API. Ersetzt den API-Key, der bis
 * 2026-10 im ausgelieferten Bundle stand.
 *
 * Die Sitzung ist ein httponly Cookie, das die API setzt; das Frontend sieht
 * sie nie und muss sie nicht speichern. Es holt sie nur, wenn ein Abruf mit
 * `code: public_session_required` abgewiesen wird (PublicSessionInterceptor).
 * Danach verlängert die API das Cookie selbst, solange die Seite benutzt wird.
 */
@Injectable({ providedIn: 'root' })
export class PublicSessionService {
  private _pending: Observable<void> | null = null;

  constructor(private _http: HttpClient) {}

  /**
   * Holt eine Sitzung. Beim Seitenaufruf ohne Cookie scheitern mehrere Abrufe
   * gleichzeitig; sie teilen sich dann ein einziges Holen, statt je eins
   * auszulösen und die Grenze je Adresse anzukratzen.
   */
  public ensure(): Observable<void> {
    if (!this._pending) {
      this._pending = this._http
        .post(
          environment.apiURL + 'public_session',
          {},
          { context: new HttpContext().set(SKIP_PUBLIC_SESSION, true) }
        )
        .pipe(
          // Nur ein 429 wird abgewartet; jeder andere Fehler geht sofort
          // weiter. Der Abruf, der die Sitzung brauchte, bleibt so lange
          // offen, die Seite lädt also nur etwas später.
          retry({
            count: PUBLIC_SESSION_MAX_RETRIES,
            delay: (err: unknown) =>
              err instanceof HttpErrorResponse && err.status === 429
                ? timer(publicSessionRetryDelay(err))
                : throwError(() => err),
          }),
          map(() => undefined),
          // Nach dem Abschluss wieder freigeben: Läuft die Sitzung später ab,
          // muss ein neues Holen möglich sein.
          finalize(() => (this._pending = null)),
          shareReplay({ bufferSize: 1, refCount: false })
        );
    }
    return this._pending;
  }
}
