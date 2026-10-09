import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { of, throwError } from 'rxjs';
import {
  getTranslocoTestingModule,
  RefereeCourseService,
} from '@floorball/core';
import { CourseLeadCourse, CourseLeadRegistration } from '@floorball/types';
import { LeadCourseDetailComponent } from './lead-course-detail.component';

function reg(id: number, status: string): CourseLeadRegistration {
  return {
    id,
    vorname: `V${id}`,
    nachname: `N${id}`,
    age_at_course: 14,
    club: null,
    lizenznummer: null,
    desired_license_level_id: null,
    status,
    result: null,
    test_version: null,
    points: null,
    custom_answers: { '3': 'keine' },
  } as CourseLeadRegistration;
}

const COURSE = {
  id: 7,
  title: 'J-Kurs Kassel',
  course_type: 'j',
  status: 'held',
  editable: true,
  sessions: [
    {
      starts_at: '2026-11-21T09:00:00+01:00',
      online_url: 'https://zoom.example/abc',
    },
  ],
  fields: [{ id: 3, label: 'Erfahrung', field_type: 'text', options: [] }],
  registrations: [reg(1, 'registered'), reg(2, 'waitlisted')],
} as unknown as CourseLeadCourse;

describe('LeadCourseDetailComponent', () => {
  function render() {
    const service = jasmine.createSpyObj('RefereeCourseService', [
      'leadCourse',
      'leadUpdateRegistration',
    ]);
    service.leadCourse.and.returnValue(of(COURSE));
    service.leadUpdateRegistration.and.callFake(
      (_c: number, id: number, patch: object) =>
        of({ ...reg(id, 'attended'), ...patch })
    );
    TestBed.configureTestingModule({
      imports: [FormsModule, getTranslocoTestingModule()],
      declarations: [LeadCourseDetailComponent],
      providers: [
        provideRouter([]),
        { provide: RefereeCourseService, useValue: service },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: '7' }) } },
        },
      ],
    });
    const fixture = TestBed.createComponent(LeadCourseDetailComponent);
    fixture.detectChanges();
    return { fixture, service };
  }

  it('trennt Teilnehmende von der Warteliste und zeigt den Online-Link', () => {
    const { fixture } = render();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelectorAll('[data-test="lead-row"]').length).toBe(1);
    expect(root.textContent).toContain('https://zoom.example/abc');
    expect(root.textContent).toContain('Erfahrung: keine');
  });

  it('speichert Testversion und Punkte nur bei Aenderung', () => {
    const { fixture, service } = render();
    const c = fixture.componentInstance;
    const r = c.seated[0];
    c.testVersionChanged(r, ' B ');
    expect(service.leadUpdateRegistration).toHaveBeenCalledWith(7, 1, {
      test_version: 'B',
    });
    service.leadUpdateRegistration.calls.reset();
    c.pointsChanged(c.seated[0], '');
    expect(service.leadUpdateRegistration).not.toHaveBeenCalled();
  });

  it('setzt die Zeile zurueck, wenn die API ablehnt', () => {
    const { fixture, service } = render();
    const c = fixture.componentInstance;
    const before = c.seated[0];
    service.leadUpdateRegistration.and.returnValue(
      throwError(() => ({ status: 422 }))
    );
    c.update(before, { status: 'attended' });
    expect(c.seated[0]).not.toBe(before);
    expect(c.seated[0].status).toBe('registered');
  });
});
