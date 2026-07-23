import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  FeedbackComment,
  FeedbackCommentsFilter,
  FeedbackTheme,
  FeedbackThemeStats,
  RefereeTag,
} from '@floorball/types';
import { environment } from 'src/environments/environment';

/**
 * Schiri-Feedback-Kommentare (Admin/FD-RSK): gefilterter Kommentar-Feed,
 * manuelle Themen-Verschlagwortung, Themen-Auswertung und der frei pflegbare
 * Themen-Katalog.
 */
@Injectable({
  providedIn: 'root',
})
export class FeedbackCommentsService {
  constructor(private http: HttpClient) {}

  private _buildParams(filter: FeedbackCommentsFilter): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filter)) {
      if (value !== null && value !== undefined && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return params;
  }

  public getComments(filter: FeedbackCommentsFilter = {}) {
    return this.http.get<FeedbackComment[]>(
      environment.apiURL + 'admin/feedback_comments',
      { params: this._buildParams(filter) }
    );
  }

  public setThemes(commentId: number, themeIds: number[]) {
    return this.http.patch<FeedbackComment>(
      `${environment.apiURL}admin/feedback_comments/${commentId}/themes`,
      { theme_ids: themeIds }
    );
  }

  public getStats(filter: FeedbackCommentsFilter = {}) {
    return this.http.get<FeedbackThemeStats>(
      environment.apiURL + 'admin/feedback_comments/stats',
      { params: this._buildParams(filter) }
    );
  }

  public getThemes() {
    return this.http.get<FeedbackTheme[]>(
      environment.apiURL + 'admin/feedback_themes'
    );
  }

  public createTheme(theme: Partial<FeedbackTheme>) {
    return this.http.post<FeedbackTheme>(
      environment.apiURL + 'admin/feedback_themes',
      { feedback_theme: theme }
    );
  }

  public updateTheme(id: number, theme: Partial<FeedbackTheme>) {
    return this.http.put<FeedbackTheme>(
      environment.apiURL + 'admin/feedback_themes/' + id,
      { feedback_theme: theme }
    );
  }

  public deleteTheme(id: number) {
    return this.http.delete(environment.apiURL + 'admin/feedback_themes/' + id);
  }

  // Top-Gruppen-Dropdown des Feeds: der pro-Spielbetrieb gescopte Schiri-Tag-
  // Katalog (identischer Endpoint wie in der Ansetzung/Schiriverwaltung).
  public getRefereeTags() {
    return this.http.get<RefereeTag[]>(
      environment.apiURL + 'admin/referee_tags'
    );
  }
}
