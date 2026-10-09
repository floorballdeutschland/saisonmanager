import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  ClubCourseReferee,
  ClubCoursesResponse,
  CourseSignupAnswers,
  GuardianConsentInfo,
  OwnCourseRegistration,
  PortalCoursesResponse,
  PublicClub,
  PublicCourseRegistrationInput,
  PublicCoursesResponse,
  PublicRegistrationLinkInfo,
  RefereeCourseOffer,
} from '@floorball/types';
import { environment } from 'src/environments/environment';

const API = environment.apiURL;

/**
 * Anmeldung zu Schiedsrichterkursen: Schiri-Portal, Verein und Einwilligung
 * der Erziehungsberechtigten.
 */
@Injectable({
  providedIn: 'root',
})
export class RefereeCourseSignupService {
  constructor(private http: HttpClient) {}

  // --- Schiri-Portal -----------------------------------------------------

  portal() {
    return this.http.get<PortalCoursesResponse>(API + 'referee/courses');
  }

  portalRegister(courseId: number, answers: CourseSignupAnswers) {
    return this.http.post<OwnCourseRegistration>(
      `${API}referee/courses/${courseId}/registration`,
      { registration: answers }
    );
  }

  portalUpdate(courseId: number, answers: CourseSignupAnswers) {
    return this.http.patch<OwnCourseRegistration>(
      `${API}referee/courses/${courseId}/registration`,
      { registration: answers }
    );
  }

  portalCancel(courseId: number) {
    return this.http.delete<OwnCourseRegistration>(
      `${API}referee/courses/${courseId}/registration`
    );
  }

  // --- Verein ------------------------------------------------------------

  club() {
    return this.http.get<ClubCoursesResponse>(API + 'club/referee_courses');
  }

  clubReferees() {
    return this.http.get<ClubCourseReferee[]>(
      API + 'club/referee_courses/referees'
    );
  }

  clubRegister(
    courseId: number,
    registration: CourseSignupAnswers & {
      referee_id?: number;
      vorname?: string;
      nachname?: string;
      geburtsdatum?: string;
      email?: string | null;
      club_id?: number | null;
      guardian_name?: string | null;
      guardian_email?: string | null;
    }
  ) {
    return this.http.post<OwnCourseRegistration>(
      `${API}club/referee_courses/${courseId}/registrations`,
      { registration }
    );
  }

  clubCancel(registrationId: number) {
    return this.http.delete<OwnCourseRegistration>(
      `${API}club/referee_courses/registrations/${registrationId}`
    );
  }

  // --- Einwilligung der Erziehungsberechtigten ----------------------------

  guardianConsent(token: string) {
    return this.http.get<GuardianConsentInfo>(
      `${API}public/course_guardian_consents/${encodeURIComponent(token)}`
    );
  }

  confirmGuardianConsent(token: string) {
    return this.http.post<{ status: string }>(
      `${API}public/course_guardian_consents/${encodeURIComponent(token)}`,
      {}
    );
  }

  // --- Öffentliche Kursseite -------------------------------------------------

  publicCourses(filter: {
    state_association_id?: number | null;
    course_format?: string | null;
    course_type?: string | null;
  }) {
    const params: Record<string, string> = {};
    if (filter.state_association_id)
      params['state_association_id'] = String(filter.state_association_id);
    if (filter.course_format) params['course_format'] = filter.course_format;
    if (filter.course_type) params['course_type'] = filter.course_type;
    return this.http.get<PublicCoursesResponse>(
      API + 'public/referee_courses',
      { params }
    );
  }

  publicCourse(id: number) {
    return this.http.get<RefereeCourseOffer & { consent_version: string }>(
      `${API}public/referee_courses/${id}`
    );
  }

  publicClubs() {
    return this.http.get<PublicClub[]>(API + 'public/referee_courses/clubs');
  }

  publicRegister(
    courseId: number,
    registration: PublicCourseRegistrationInput
  ) {
    return this.http.post<{ status: string }>(
      `${API}public/referee_courses/${courseId}/registrations`,
      { registration }
    );
  }

  registrationLink(kind: 'confirm' | 'cancel', token: string) {
    return this.http.get<PublicRegistrationLinkInfo>(
      `${API}public/course_registrations/${kind}/${encodeURIComponent(token)}`
    );
  }

  submitRegistrationLink(kind: 'confirm' | 'cancel', token: string) {
    return this.http.post<{ status: string; late_cancellation?: boolean }>(
      `${API}public/course_registrations/${kind}/${encodeURIComponent(token)}`,
      {}
    );
  }
}
