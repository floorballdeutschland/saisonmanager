import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  RefereeFeedbackGame,
  RefereeFeedbackStatus,
  RefereeFeedbackSubmit,
} from '@floorball/types';
import { environment } from 'src/environments/environment';

/**
 * Team-seitiges Schiri-Feedback (TM/VM): feedback-pflichtige Spiele der eigenen
 * Mannschaften abrufen und eine Rückmeldung absenden.
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
}
