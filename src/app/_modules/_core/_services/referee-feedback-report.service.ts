import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  RefereeFeedbackReport,
  RefereeFeedbackReportQuery,
  RefereeTag,
} from '@floorball/types';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class RefereeFeedbackReportService {
  constructor(private http: HttpClient) {}

  public getAnalytics(query: RefereeFeedbackReportQuery = {}) {
    return this.http.get<RefereeFeedbackReport>(
      environment.apiURL + 'admin/referee_feedback_analytics',
      { params: this._buildParams(query) }
    );
  }

  public exportCsv(query: RefereeFeedbackReportQuery = {}) {
    return this.http.get(
      environment.apiURL + 'admin/referee_feedback_analytics/export.csv',
      { params: this._buildParams(query), responseType: 'blob' }
    );
  }

  public exportXlsx(query: RefereeFeedbackReportQuery = {}) {
    return this.http.get(
      environment.apiURL + 'admin/referee_feedback_analytics/export.xlsx',
      { params: this._buildParams(query), responseType: 'blob' }
    );
  }

  // Referee-Tag-Katalog für das „Top-Gruppe"-Dropdown.
  public getTags() {
    return this.http.get<RefereeTag[]>(
      environment.apiURL + 'admin/referee_tags'
    );
  }

  private _buildParams(query: RefereeFeedbackReportQuery): HttpParams {
    let params = new HttpParams();
    if (query.season_id) params = params.set('season_id', query.season_id);
    if (query.league_id != null)
      params = params.set('league_id', String(query.league_id));
    if (query.tag_id != null)
      params = params.set('tag_id', String(query.tag_id));
    if (query.from) params = params.set('from', query.from);
    if (query.to) params = params.set('to', query.to);
    if (query.result) params = params.set('result', query.result);
    if (query.min_count != null)
      params = params.set('min_count', String(query.min_count));
    return params;
  }
}
