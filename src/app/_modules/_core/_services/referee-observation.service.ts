import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  RefereeObservation,
  RefereeObservationAdminResponse,
  RefereeObservationAnswers,
  RefereeObservationCandidate,
  RefereeObservationReport,
  RefereeObservationReportQuery,
} from '@floorball/types';
import { environment } from 'src/environments/environment';

/**
 * Beobachtungsbögen des Schiedsrichtercoaches. Dasselbe Konto in zwei Rollen:
 * als Coach schreiben, als beobachtete Person lesen. Dazu die Sicht der
 * Schiedsrichterverwaltung am Profil.
 */
@Injectable({
  providedIn: 'root',
})
export class RefereeObservationService {
  constructor(private http: HttpClient) {}

  /** Eigene Bögen als Coach – auch zurückgenommene. */
  public getMyObservations() {
    return this.http.get<RefereeObservation[]>(
      environment.apiURL + 'referee/observations'
    );
  }

  /** Spiele, zu denen abgegeben werden darf, mit vorbelegtem Gespann. */
  public getObservableGames() {
    return this.http.get<RefereeObservationCandidate[]>(
      environment.apiURL + 'referee/observations/games'
    );
  }

  public submit(body: RefereeObservationAnswers) {
    return this.http.post<RefereeObservation>(
      environment.apiURL + 'referee/observations',
      body
    );
  }

  /** Erhaltene Rückmeldungen der eigenen Person. */
  public getReceived() {
    return this.http.get<RefereeObservation[]>(
      environment.apiURL + 'referee/observations/received'
    );
  }

  /** Verwaltungssicht am Schiedsrichterprofil. */
  public adminGetForReferee(refereeId: number) {
    return this.http.get<RefereeObservationAdminResponse>(
      environment.apiURL + `admin/referees/${refereeId}/observations`
    );
  }

  /** Übersicht aller Bögen, die das Konto in der Verwaltung sehen darf. */
  public adminGetReport(query: RefereeObservationReportQuery = {}) {
    return this.http.get<RefereeObservationReport>(
      environment.apiURL + 'admin/referee_observation_report',
      { params: this._reportParams(query) }
    );
  }

  /**
   * Export als CSV oder Excel: mit `ids` nur die ausgewählten Bögen, sonst alle
   * zum Filter passenden. Ohne Freitexte, die stehen nur im Bogen selbst.
   */
  public adminExportReport(
    format: 'csv' | 'xlsx',
    query: RefereeObservationReportQuery = {},
    ids: number[] = []
  ) {
    let params = this._reportParams(query);
    for (const id of ids) params = params.append('ids[]', String(id));
    return this.http.get(
      environment.apiURL + `admin/referee_observation_report/export.${format}`,
      { params, responseType: 'blob' }
    );
  }

  /** Zurücknehmen bzw. Wiederherstellen eines Bogens. */
  public adminSetStatus(id: number, status: 'visible' | 'hidden') {
    return this.http.patch(
      environment.apiURL + `admin/referee_observations/${id}`,
      { status }
    );
  }

  private _reportParams(query: RefereeObservationReportQuery): HttpParams {
    let params = new HttpParams();
    if (query.season_id) params = params.set('season_id', query.season_id);
    if (query.game_operation_id != null)
      params = params.set('game_operation_id', String(query.game_operation_id));
    if (query.coach_id != null)
      params = params.set('coach_id', String(query.coach_id));
    if (query.referee_id != null)
      params = params.set('referee_id', String(query.referee_id));
    if (query.status) params = params.set('status', query.status);
    if (query.from) params = params.set('from', query.from);
    if (query.to) params = params.set('to', query.to);
    return params;
  }
}
