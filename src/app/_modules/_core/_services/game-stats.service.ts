import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DetailedStats, Highlights } from '@floorball/types';
import { environment } from 'src/environments/environment';
import { refreshContext } from '../_http/silent-refresh';

/**
 * Öffentliche Auswertungen der im Tabletmodus erfassten Spiele (fe#344).
 *
 * Eigener Dienst statt weiterer Methoden im GameService: Die Endpunkte gibt es
 * nur für Tablet-Spiele (sonst 404), und die Spielseite fragt sie nur ab, wenn
 * das Spiel `tablet_capture` meldet.
 */
@Injectable({ providedIn: 'root' })
export class GameStatsService {
  constructor(private http: HttpClient) {}

  /** `silent`: Hintergrund-Aktualisierung, siehe SILENT_REFRESH. */
  public getDetailedStats(gameId: number, silent = false) {
    const path =
      environment.apiURL + 'games/' + gameId + '/detailed_stats.json';
    return this.http.get<DetailedStats>(path, {
      context: refreshContext(silent),
    });
  }

  /** Torszenen in der Stream-Aufzeichnung (fe#555). */
  public getHighlights(gameId: number, silent = false) {
    const path = environment.apiURL + 'games/' + gameId + '/highlights.json';
    return this.http.get<Highlights>(path, {
      context: refreshContext(silent),
    });
  }
}
