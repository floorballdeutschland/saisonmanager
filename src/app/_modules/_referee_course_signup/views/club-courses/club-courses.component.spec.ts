import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import {
  getTranslocoTestingModule,
  NotificationService,
  RefereeCourseSignupService,
} from '@floorball/core';
import { RefereeCourseSignupSharedModule } from '../../referee-course-signup-shared.module';
import { offer, ownRegistration } from '../../spec-fixtures';
import { ClubCoursesComponent } from './club-courses.component';

describe('ClubCoursesComponent', () => {
  function render() {
    const service = jasmine.createSpyObj('RefereeCourseSignupService', [
      'club',
      'clubReferees',
      'clubRegister',
      'clubCancel',
    ]);
    service.club.and.returnValue(
      of({
        clubs: [{ id: 5, name: 'TV Kassel' }],
        courses: [offer(1)],
        registrations: [
          ownRegistration(7, { referee_id: 40, source: 'club' }),
          ownRegistration(8, { status: 'cancelled_by_participant' }),
        ],
      })
    );
    service.clubReferees.and.returnValue(
      of([
        {
          id: 40,
          vorname: 'Ada',
          nachname: 'Muster',
          lizenznummer: 1,
          lizenzstufe: 'L3',
          club_id: 5,
        },
      ])
    );
    service.clubRegister.and.returnValue(
      of(ownRegistration(9, { status: 'pending_guardian' }))
    );
    TestBed.configureTestingModule({
      imports: [
        FormsModule,
        RefereeCourseSignupSharedModule,
        getTranslocoTestingModule(),
      ],
      declarations: [ClubCoursesComponent],
      providers: [
        { provide: RefereeCourseSignupService, useValue: service },
        {
          provide: NotificationService,
          useValue: jasmine.createSpyObj('NotificationService', ['success']),
        },
      ],
    });
    const fixture = TestBed.createComponent(ClubCoursesComponent);
    fixture.detectChanges();
    return { fixture, service };
  }

  it('blendet Abgemeldete aus und erkennt bereits angemeldete Schiris', () => {
    const { fixture } = render();
    const c = fixture.componentInstance;
    expect(c.visibleRegistrations.map((r) => r.id)).toEqual([7]);
    expect(c.alreadyRegistered(c.courses[0], 40)).toBeTrue();
    expect(c.registeredFor(c.courses[0])).toBe(1);
  });

  it('verlangt bei unter 16-Jaehrigen die Erziehungsberechtigten', () => {
    const { fixture, service } = render();
    const c = fixture.componentInstance;
    const course = c.courses[0];
    c.open(course);
    expect(c.person.club_id).toBe(5);
    c.mode = 'person';
    c.person = {
      ...c.person,
      vorname: 'Kim',
      nachname: 'Klein',
      geburtsdatum: '2014-05-01',
    };
    c.answers = { ...c.answers, custom_answers: { '11': 'S' } };
    expect(c.needsGuardian(course)).toBeTrue();
    expect(c.canSubmit(course)).toBeFalse();

    c.person = {
      ...c.person,
      guardian_name: 'Eva Klein',
      guardian_email: 'eva@example.org',
    };
    expect(c.canSubmit(course)).toBeTrue();
    c.register(course);
    const payload = service.clubRegister.calls.mostRecent().args[1];
    expect(payload.guardian_email).toBe('eva@example.org');
    expect(payload.club_id).toBe(5);
    expect(payload.email).toBeNull();
  });

  it('16 am ersten Kurstag braucht keine Einwilligung', () => {
    const { fixture } = render();
    const c = fixture.componentInstance;
    c.open(c.courses[0]);
    c.mode = 'person';
    c.person = { ...c.person, geburtsdatum: '2010-11-21' };
    expect(c.ageAtCourse(c.courses[0])).toBe(16);
    expect(c.needsGuardian(c.courses[0])).toBeFalse();
  });

  it('warnt bei Abmeldung nach der Frist, nicht bei Wartenden', () => {
    const { fixture } = render();
    const c = fixture.componentInstance;
    c.courses = [
      { ...c.courses[0], cancellation_deadline: '2020-01-01T00:00:00Z' },
    ];
    expect(c.lateCancellation(c.registrations[0])).toBeTrue();
    expect(
      c.lateCancellation({ ...c.registrations[0], status: 'waitlisted' })
    ).toBeFalse();
  });
});
