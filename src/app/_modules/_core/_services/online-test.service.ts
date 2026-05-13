import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  OnlineTest,
  OnlineTestAnswer,
  OnlineTestAssignment,
  OnlineTestQuestion,
  OnlineTestResult,
  RefereeOnlineTestDetail,
  RefereeOnlineTestListItem,
  RefereeOnlineTestStartResponse,
} from '@floorball/types';

@Injectable({ providedIn: 'root' })
export class OnlineTestService {
  private base = environment.apiURL;

  constructor(private http: HttpClient) {}

  // Admin
  adminGetAll(lizenzstufe?: string): Observable<OnlineTest[]> {
    const params: Record<string, string> = {};
    if (lizenzstufe) params['lizenzstufe'] = lizenzstufe;
    return this.http.get<OnlineTest[]>(`${this.base}admin/online_tests.json`, {
      params,
    });
  }

  adminGet(id: number): Observable<OnlineTest> {
    return this.http.get<OnlineTest>(
      `${this.base}admin/online_tests/${id}.json`
    );
  }

  adminCreate(data: Partial<OnlineTest>): Observable<OnlineTest> {
    return this.http.post<OnlineTest>(`${this.base}admin/online_tests.json`, {
      online_test: data,
    });
  }

  adminUpdate(id: number, data: Partial<OnlineTest>): Observable<OnlineTest> {
    return this.http.patch<OnlineTest>(
      `${this.base}admin/online_tests/${id}.json`,
      { online_test: data }
    );
  }

  adminDelete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}admin/online_tests/${id}.json`);
  }

  adminPublish(id: number): Observable<OnlineTest> {
    return this.http.post<OnlineTest>(
      `${this.base}admin/online_tests/${id}/publish.json`,
      {}
    );
  }

  adminGetResults(id: number): Observable<{
    test: OnlineTest;
    penalty_options: string[];
    results: OnlineTestResult[];
  }> {
    return this.http.get<{
      test: OnlineTest;
      penalty_options: string[];
      results: OnlineTestResult[];
    }>(`${this.base}admin/online_tests/${id}/results.json`);
  }

  // Questions
  adminCreateQuestion(
    testId: number,
    data: Partial<OnlineTestQuestion>
  ): Observable<OnlineTestQuestion> {
    return this.http.post<OnlineTestQuestion>(
      `${this.base}admin/online_tests/${testId}/questions.json`,
      { online_test_question: data }
    );
  }

  adminUpdateQuestion(
    testId: number,
    questionId: number,
    data: Partial<OnlineTestQuestion>
  ): Observable<OnlineTestQuestion> {
    return this.http.patch<OnlineTestQuestion>(
      `${this.base}admin/online_tests/${testId}/questions/${questionId}.json`,
      { online_test_question: data }
    );
  }

  adminDeleteQuestion(testId: number, questionId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.base}admin/online_tests/${testId}/questions/${questionId}.json`
    );
  }

  // Assignments
  adminGetAssignments(testId: number): Observable<OnlineTestAssignment[]> {
    return this.http.get<OnlineTestAssignment[]>(
      `${this.base}admin/online_tests/${testId}/assignments.json`
    );
  }

  adminCreateAssignment(
    testId: number,
    refereeId: number
  ): Observable<OnlineTestAssignment> {
    return this.http.post<OnlineTestAssignment>(
      `${this.base}admin/online_tests/${testId}/assignments.json`,
      { referee_id: refereeId }
    );
  }

  adminDeleteAssignment(
    testId: number,
    assignmentId: number
  ): Observable<void> {
    return this.http.delete<void>(
      `${this.base}admin/online_tests/${testId}/assignments/${assignmentId}.json`
    );
  }

  // Referee self-service
  refereeGetAll(): Observable<RefereeOnlineTestListItem[]> {
    return this.http.get<RefereeOnlineTestListItem[]>(
      `${this.base}referee/online_tests.json`
    );
  }

  refereeGet(id: number): Observable<RefereeOnlineTestDetail> {
    return this.http.get<RefereeOnlineTestDetail>(
      `${this.base}referee/online_tests/${id}.json`
    );
  }

  refereeStart(id: number): Observable<RefereeOnlineTestStartResponse> {
    return this.http.post<RefereeOnlineTestStartResponse>(
      `${this.base}referee/online_tests/${id}/start.json`,
      {}
    );
  }

  refereeSubmit(
    id: number,
    answers: OnlineTestAnswer[]
  ): Observable<{
    attempt_id: number;
    error_points: number;
    passed: boolean | null;
  }> {
    return this.http.post<{
      attempt_id: number;
      error_points: number;
      passed: boolean | null;
    }>(`${this.base}referee/online_tests/${id}/submit.json`, { answers });
  }
}
