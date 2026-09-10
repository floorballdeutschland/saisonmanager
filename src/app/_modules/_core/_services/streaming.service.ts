import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  StreamingBroadcastInput,
  StreamingFilter,
  StreamingGame,
} from '@floorball/types';
import { environment } from 'src/environments/environment';

/**
 * Die Datenbasis des Streaming-Bereichs.
 *
 * Nur für Admin und den Bundesverband: Die Antwort trägt den Streamschlüssel im
 * Klartext, und wer ihn hat, sendet auf den Verbandskanal. Der Server prüft das,
 * nicht diese Stelle.
 */
@Injectable({
  providedIn: 'root',
})
export class StreamingService {
  constructor(private http: HttpClient) {}

  /**
   * Die Spiele eines Zeitraums oder eines Spieltags.
   *
   * Zwei Zuschnitte, weil so gearbeitet wird: Ein Wochenende wird quer über die
   * Ligen eingerichtet (so ist auch die alte Excel-Vorlage sortiert), ein
   * einzelner Spieltag dagegen über alle seine Hallen -- im Datenmodell ist ein
   * Spieltag ein Spieltags*ort*, und mehrere teilen sich dieselbe Nummer.
   */
  public getGames(filter: StreamingFilter): Observable<StreamingGame[]> {
    const params =
      'from' in filter
        ? new HttpParams().set('from', filter.from).set('to', filter.to)
        : new HttpParams()
            .set('league_id', filter.leagueId)
            .set('game_day_number', filter.gameDayNumber);

    return this.http.get<StreamingGame[]>(
      `${environment.apiURL}admin/streaming/games`,
      { params }
    );
  }

  /**
   * Meldet eine bei YouTube angelegte Übertragung zurück.
   *
   * Der Server hält sie fest (damit der Wächter sie kennt) und schreibt den Link
   * ins Spiel -- aber nur bei öffentlicher Übertragung und nie über einen
   * vorhandenen. Vereine senden parallel auf ihren eigenen Kanal; steht dort
   * schon ihr Link, ist er der richtige.
   */
  public recordBroadcast(
    gameId: number,
    input: StreamingBroadcastInput
  ): Observable<StreamingGame> {
    return this.http.post<StreamingGame>(
      `${environment.apiURL}admin/streaming/games/${gameId}/broadcast`,
      input
    );
  }
}
