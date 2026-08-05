import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  ApiKeyApplication,
  ApiKeyApplicationStatus,
  ApiKeyApplicationSubmission,
  ApiKeyRevealStatus,
  RevealedApiKey,
} from '@floorball/types';
import { environment } from 'src/environments/environment';

/**
 * Antrag auf einen API-Zugang: öffentliche Einreichung und Abholung des Keys
 * sowie die Entscheidung in der Verwaltung.
 *
 * Die öffentlichen Aufrufe brauchen keine Anmeldung; den API-Key hängt der
 * ApiKeyInterceptor an.
 */
@Injectable({
  providedIn: 'root',
})
export class ApiKeyApplicationService {
  constructor(private http: HttpClient) {}

  /**
   * Gültige Fassung der Nutzungsvereinbarung. Das Formular schickt sie beim
   * Absenden mit, damit der Server eine Zustimmung zu einer überholten Fassung
   * erkennt (offener Tab über eine Änderung hinweg).
   */
  public getTermsVersion() {
    return this.http.get<{ version: string }>(
      environment.apiURL + 'api_terms_version'
    );
  }

  public submit(submission: ApiKeyApplicationSubmission) {
    return this.http.post<{ success: boolean }>(
      environment.apiURL + 'api_key_applications',
      { api_key_application: submission }
    );
  }

  /** Prüft den Abhol-Link, ohne ihn zu verbrauchen. */
  public checkRevealToken(token: string) {
    return this.http.get<ApiKeyRevealStatus>(
      environment.apiURL +
        'api_key_applications/reveal/' +
        encodeURIComponent(token)
    );
  }

  /** Erzeugt den Key und liefert ihn im Klartext. Nur einmal möglich. */
  public revealKey(token: string) {
    return this.http.post<RevealedApiKey>(
      environment.apiURL + 'api_key_applications/reveal',
      { token }
    );
  }

  public getAll(status?: ApiKeyApplicationStatus) {
    const query = status ? '?status=' + status : '';
    return this.http.get<ApiKeyApplication[]>(
      environment.apiURL + 'admin/api_key_applications' + query
    );
  }

  public approve(id: number, decisionNote?: string) {
    return this.http.post<ApiKeyApplication>(
      environment.apiURL + 'admin/api_key_applications/' + id + '/approve',
      { decision_note: decisionNote ?? '' }
    );
  }

  public reject(id: number, decisionNote: string) {
    return this.http.post<ApiKeyApplication>(
      environment.apiURL + 'admin/api_key_applications/' + id + '/reject',
      { decision_note: decisionNote }
    );
  }

  public resendReveal(id: number) {
    return this.http.post<ApiKeyApplication>(
      environment.apiURL +
        'admin/api_key_applications/' +
        id +
        '/resend_reveal',
      {}
    );
  }
}
