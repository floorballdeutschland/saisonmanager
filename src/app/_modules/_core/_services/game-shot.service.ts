import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';

import { ServerTimeResponse, ShotInput, ShotsResponse } from '@floorball/types';
import { environment } from 'src/environments/environment';
import { refreshContext } from '../_http/silent-refresh';

/**
 * Schusserfassung im Tabletmodus der Spielberichtseingabe (fe#344, api#816).
 *
 * Die Schreibwege laufen still (SILENT_REFRESH): Am Spielfeldrand bricht die
 * Verbindung ständig weg, und die Erfassung puffert jeden Schuss lokal und
 * sendet ihn später erneut. Ein Toast pro Fehlversuch wäre dort reines
 * Rauschen; den Stand zeigt die Erfassung selbst an. 403 und 404 auf diese
 * Pfade übergeht der ErrorInterceptor ebenfalls (Bericht geschlossen, Schuss
 * schon gelöscht), übrige fachliche Absagen (4xx) meldet er weiterhin.
 */
@Injectable({
  providedIn: 'root',
})
export class GameShotService {
  constructor(private http: HttpClient) {}

  private _path(gameId: number, suffix = ''): string {
    return environment.apiURL + 'games/' + gameId + '/shots' + suffix;
  }

  public getShots(gameId: number) {
    return this.http
      .get<ShotsResponse>(this._path(gameId, '.json'), {
        context: refreshContext(true),
      })
      .pipe(map((response) => response.shots ?? []));
  }

  /** Idempotent über `client_uuid`: Vorhandene Schüsse werden aktualisiert. */
  public saveShots(gameId: number, shots: ShotInput[]) {
    return this.http
      .post<ShotsResponse>(
        this._path(gameId, '.json'),
        { shots },
        { context: refreshContext(true) }
      )
      .pipe(map((response) => response.shots ?? []));
  }

  public updateShot(
    gameId: number,
    clientUuid: string,
    changes: Partial<ShotInput>
  ) {
    return this.http
      .patch<ShotsResponse>(
        this._path(gameId, '/' + encodeURIComponent(clientUuid) + '.json'),
        changes,
        { context: refreshContext(true) }
      )
      .pipe(map((response) => response.shots ?? []));
  }

  public deleteShot(gameId: number, clientUuid: string) {
    return this.http
      .delete<ShotsResponse>(
        this._path(gameId, '/' + encodeURIComponent(clientUuid) + '.json'),
        { context: refreshContext(true) }
      )
      .pipe(map((response) => response.shots ?? []));
  }

  /** Verknüpft einen Schuss mit einem Tor aus games.events (null löst sie). */
  public linkShot(gameId: number, clientUuid: string, eventId: number | null) {
    return this.http
      .post<ShotsResponse>(
        this._path(gameId, '/' + encodeURIComponent(clientUuid) + '/link.json'),
        { event_id: eventId }
      )
      .pipe(map((response) => response.shots ?? []));
  }

  public setTabletShotsComplete(gameId: number, complete: boolean) {
    return this.http.put<{ tablet_shots_complete: boolean }>(
      environment.apiURL + 'games/' + gameId + '/tablet_capture.json',
      { complete }
    );
  }

  public getServerTime() {
    return this.http.get<ServerTimeResponse>(
      environment.apiURL + 'server_time.json',
      { context: refreshContext(true) }
    );
  }
}
