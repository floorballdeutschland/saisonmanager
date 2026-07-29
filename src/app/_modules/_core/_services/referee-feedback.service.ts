import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  RefereeFeedbackAnswers,
  RefereeFeedbackGame,
  RefereeFeedbackInvitation,
  RefereeFeedbackStatus,
  RefereeFeedbackSubmit,
  RefereeFeedbackTeamSettings,
} from '@floorball/types';
import { environment } from 'src/environments/environment';

/**
 * Schiri-Feedback: feedback-pflichtige Spiele der eigenen Mannschaften abrufen
 * und eine Rückmeldung absenden (TM/VM), die Einstellung verwalten, wer das
 * Feedback abgibt, sowie die Abgabe über einen Einmal-Link ohne Anmeldung.
 */
@Injectable({
  providedIn: 'root',
})
export class RefereeFeedbackService {
  constructor(private http: HttpClient) {}

  public getMyFeedbacks() {
    return this.http.get<RefereeFeedbackGame[]>(
      environment.apiURL + 'user/referee_feedbacks'
    );
  }

  public submit(body: RefereeFeedbackSubmit) {
    return this.http.post<RefereeFeedbackStatus>(
      environment.apiURL + 'user/referee_feedbacks',
      body
    );
  }

  /** Einstellung je Mannschaft, wer das Feedback abgibt. */
  public getSettings() {
    return this.http.get<RefereeFeedbackTeamSettings[]>(
      environment.apiURL + 'user/referee_feedback_settings'
    );
  }

  public updateSettings(
    teamId: number,
    body: {
      feedback_contact_email: string;
      feedback_contact_prefer_captain: boolean;
    }
  ) {
    return this.http.patch<RefereeFeedbackTeamSettings>(
      environment.apiURL + `user/referee_feedback_settings/${teamId}`,
      body
    );
  }

  /**
   * Abgabe über Einmal-Link, ohne Anmeldung. Der Token ist die einzige
   * Berechtigung und gilt nur für genau ein Spiel und eine Mannschaft.
   */
  public getInvitation(token: string) {
    return this.http.get<RefereeFeedbackInvitation>(
      environment.apiURL + `referee_feedback_invitations/${token}`
    );
  }

  public submitInvitation(token: string, body: RefereeFeedbackAnswers) {
    return this.http.post<RefereeFeedbackStatus>(
      environment.apiURL + `referee_feedback_invitations/${token}`,
      body
    );
  }
}
