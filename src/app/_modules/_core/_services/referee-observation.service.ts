import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  RefereeObservation,
  RefereeObservationAdminResponse,
  RefereeObservationAnswers,
  RefereeObservationCandidate,
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

  /** Zurücknehmen bzw. Wiederherstellen eines Bogens. */
  public adminSetStatus(id: number, status: 'visible' | 'hidden') {
    return this.http.patch(
      environment.apiURL + `admin/referee_observations/${id}`,
      { status }
    );
  }
}
