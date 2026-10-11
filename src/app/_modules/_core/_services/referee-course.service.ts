import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  CourseLicensingRow,
  CourseLeadCourse,
  CourseLeadRegistration,
  RefereeCourse,
  RefereeCourseField,
  RefereeCourseInput,
  RefereeCourseLeadEntry,
  RefereeCourseLeadInput,
  RefereeCourseOptions,
  RefereeCourseRegistration,
  RefereeCourseRegistrationInput,
  RefereeCourseSummary,
} from '@floorball/types';
import { environment } from 'src/environments/environment';

const BASE = environment.apiURL + 'admin/referee_courses';
const TEMPLATES = environment.apiURL + 'admin/referee_course_field_templates';
const LEAD = environment.apiURL + 'course_lead/courses';
const LICENSING = environment.apiURL + 'admin/referee_course_licensing';

/** Schiedsrichterkurse im System, Verwaltung durch RSK und Admin. */
@Injectable({
  providedIn: 'root',
})
export class RefereeCourseService {
  constructor(private http: HttpClient) {}

  list(filter: { from?: string; status?: string } = {}) {
    let params = new HttpParams();
    if (filter.from) params = params.set('from', filter.from);
    if (filter.status) params = params.set('status', filter.status);
    return this.http.get<RefereeCourseSummary[]>(BASE, { params });
  }

  options() {
    return this.http.get<RefereeCourseOptions>(BASE + '/options');
  }

  get(id: number) {
    return this.http.get<RefereeCourse>(`${BASE}/${id}`);
  }

  create(course: RefereeCourseInput) {
    return this.http.post<RefereeCourse>(BASE, { referee_course: course });
  }

  update(id: number, course: RefereeCourseInput) {
    return this.http.patch<RefereeCourse>(`${BASE}/${id}`, {
      referee_course: course,
    });
  }

  delete(id: number) {
    return this.http.delete<void>(`${BASE}/${id}`);
  }

  // --- Zusatzfelder am Kurs ----------------------------------------------

  createField(courseId: number, field: RefereeCourseField) {
    return this.http.post<RefereeCourseField>(`${BASE}/${courseId}/fields`, {
      field,
    });
  }

  updateField(
    courseId: number,
    id: number,
    field: Partial<RefereeCourseField>
  ) {
    return this.http.patch<RefereeCourseField>(
      `${BASE}/${courseId}/fields/${id}`,
      { field }
    );
  }

  deleteField(courseId: number, id: number) {
    return this.http.delete<void>(`${BASE}/${courseId}/fields/${id}`);
  }

  // --- Feldvorlagen je LV --------------------------------------------------

  listTemplates(stateAssociationId: number | null) {
    let params = new HttpParams();
    if (stateAssociationId !== null)
      params = params.set('state_association_id', stateAssociationId);
    return this.http.get<RefereeCourseField[]>(TEMPLATES, { params });
  }

  createTemplate(stateAssociationId: number | null, field: RefereeCourseField) {
    return this.http.post<RefereeCourseField>(TEMPLATES, {
      field: { ...field, state_association_id: stateAssociationId },
    });
  }

  updateTemplate(id: number, field: Partial<RefereeCourseField>) {
    return this.http.patch<RefereeCourseField>(`${TEMPLATES}/${id}`, {
      field,
    });
  }

  deleteTemplate(id: number) {
    return this.http.delete<void>(`${TEMPLATES}/${id}`);
  }

  // --- Teilnehmerliste ---------------------------------------------------

  listRegistrations(courseId: number) {
    return this.http.get<RefereeCourseRegistration[]>(
      `${BASE}/${courseId}/registrations`
    );
  }

  createRegistration(
    courseId: number,
    registration: RefereeCourseRegistrationInput
  ) {
    return this.http.post<RefereeCourseRegistration>(
      `${BASE}/${courseId}/registrations`,
      { registration }
    );
  }

  updateRegistration(
    courseId: number,
    id: number,
    registration: RefereeCourseRegistrationInput
  ) {
    return this.http.patch<RefereeCourseRegistration>(
      `${BASE}/${courseId}/registrations/${id}`,
      { registration }
    );
  }

  cancelRegistration(courseId: number, id: number) {
    return this.http.delete<void>(`${BASE}/${courseId}/registrations/${id}`);
  }

  // --- Kursleitungen am Kurs (RSK) ---------------------------------------

  addLead(courseId: number, lead: RefereeCourseLeadInput) {
    return this.http.post<RefereeCourseLeadEntry>(`${BASE}/${courseId}/leads`, {
      lead,
    });
  }

  setMainLead(courseId: number, id: number, lead: boolean) {
    return this.http.patch<RefereeCourseLeadEntry>(
      `${BASE}/${courseId}/leads/${id}`,
      { lead: { lead } }
    );
  }

  removeLead(courseId: number, id: number) {
    return this.http.delete<void>(`${BASE}/${courseId}/leads/${id}`);
  }

  // --- „Meine Kurse" der Kursleitung -------------------------------------

  leadCourses() {
    return this.http.get<RefereeCourseSummary[]>(LEAD);
  }

  leadCourse(id: number) {
    return this.http.get<CourseLeadCourse>(`${LEAD}/${id}`);
  }

  leadUpdateRegistration(
    courseId: number,
    id: number,
    registration: Partial<
      Pick<
        CourseLeadRegistration,
        'status' | 'result' | 'test_version' | 'points'
      >
    >
  ) {
    return this.http.patch<CourseLeadRegistration>(
      `${LEAD}/${courseId}/registrations/${id}`,
      { registration }
    );
  }

  // --- Einreichen und Lizenzvergabe (FD) -----------------------------------

  submitResults(courseId: number) {
    return this.http.post<RefereeCourse & { submitted_results: number }>(
      `${BASE}/${courseId}/submit_results`,
      {}
    );
  }

  licensing(status: 'pending' | 'done' = 'pending') {
    return this.http.get<CourseLicensingRow[]>(LICENSING, {
      params: { status },
    });
  }

  licensingUpdate(
    id: number,
    licensing: { lizenzstufe?: string | null; referee_id?: number | null }
  ) {
    return this.http.patch<CourseLicensingRow>(`${LICENSING}/${id}`, {
      licensing,
    });
  }

  licensingApprove(id: number) {
    return this.http.post<CourseLicensingRow>(`${LICENSING}/${id}/approve`, {});
  }

  licensingApproveMany(ids: number[]) {
    return this.http.post<{
      results: { id: number; ok?: boolean; error?: string }[];
    }>(`${LICENSING}/approve_many`, { ids });
  }

  licensingReject(id: number, rejectionReason: string) {
    return this.http.post<CourseLicensingRow>(`${LICENSING}/${id}/reject`, {
      rejection_reason: rejectionReason,
    });
  }
}
