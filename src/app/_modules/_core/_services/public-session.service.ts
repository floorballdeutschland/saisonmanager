import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpContext,
  HttpContextToken,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { finalize, map, shareReplay } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

/**
 * Markiert den Abruf, der die Sitzung holt. Der PublicSessionInterceptor
 * lässt ihn durch, sonst könnte ein abgewiesenes Holen sich selbst erneut
 * anstoßen.
 */
export const SKIP_PUBLIC_SESSION = new HttpContextToken<boolean>(() => false);

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
