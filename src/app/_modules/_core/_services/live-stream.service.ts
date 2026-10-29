import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { LiveStreamDay } from '@floorball/types';
import { refreshContext } from '../_http/silent-refresh';
import { environment } from 'src/environments/environment';

/**
 * Die Livestreams des Tages.
 *
 * Ein gewöhnlicher öffentlicher Abruf über die anonyme Website-Sitzung
 * (PublicSessionInterceptor). Die API verzögert Zwischenstände laufender
 * Partien nur für API-Keys ohne Echtzeit-Freigabe, auf der eigenen Website gilt
 * also keine Verzögerung — das entscheidet der Server und nicht diese Stelle.
 */
@Injectable({
  providedIn: 'root',
})
export class LiveStreamService {
  constructor(private http: HttpClient) {}

  /** `silent`: Hintergrund-Aktualisierung, siehe SILENT_REFRESH. */
  public getToday(silent = false) {
    return this.http.get<LiveStreamDay>(
      `${environment.apiURL}live_streams.json`,
      { context: refreshContext(silent) }
    );
  }
}
