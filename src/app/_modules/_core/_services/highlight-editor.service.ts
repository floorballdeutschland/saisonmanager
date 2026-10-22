import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { HighlightEditorData, HighlightEditorUpdate } from '@floorball/types';
import { environment } from 'src/environments/environment';

/**
 * Kalibrierung und Szenenauswahl eines Tablet-Spiels (api#838).
 *
 * Zwei Zugänge mit derselben Antwort: der Mail-Link (`token`, ohne Konto) und
 * Admin bzw. SBK des Spielbetriebs über die Spiel-ID (Sitzung). Fehler zeigt
 * die Seite selbst; der ErrorInterceptor schweigt für den Token-Weg ganz und
 * für den Spiel-Weg bei 403/404.
 */
@Injectable({ providedIn: 'root' })
export class HighlightEditorService {
  constructor(private http: HttpClient) {}

  public getByToken(token: string) {
    return this.http.get<HighlightEditorData>(this._tokenPath(), {
      params: new HttpParams().set('token', token),
    });
  }

  public updateByToken(token: string, update: HighlightEditorUpdate) {
    return this.http.put<HighlightEditorData>(this._tokenPath(), update, {
      params: new HttpParams().set('token', token),
    });
  }

  public getForGame(gameId: number) {
    return this.http.get<HighlightEditorData>(this._gamePath(gameId));
  }

  public updateForGame(gameId: number, update: HighlightEditorUpdate) {
    return this.http.put<HighlightEditorData>(this._gamePath(gameId), update);
  }

  private _tokenPath(): string {
    return environment.apiURL + 'highlight_editor.json';
  }

  private _gamePath(gameId: number): string {
    return environment.apiURL + 'games/' + gameId + '/highlight_editor.json';
  }
}
