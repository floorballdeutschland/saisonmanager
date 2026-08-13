import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { LiveStreamDay } from '@floorball/types';
import { environment } from 'src/environments/environment';

/**
 * Die Livestreams des Tages.
 *
 * Ein gewöhnlicher öffentlicher Abruf: Der ApiKeyInterceptor hängt den
 * Frontend-Schlüssel an, und der hat Echtzeit-Freigabe. Für Zwischenstände
 * laufender Partien gilt damit auf der eigenen Website keine Verzögerung — für
 * fremde Zugänge sehr wohl, das entscheidet aber der Server und nicht diese
 * Stelle.
 */
@Injectable({
  providedIn: 'root',
})
export class LiveStreamService {
  constructor(private http: HttpClient) {}

  public getToday() {
    return this.http.get<LiveStreamDay>(
      `${environment.apiURL}live_streams.json`
    );
  }
}
