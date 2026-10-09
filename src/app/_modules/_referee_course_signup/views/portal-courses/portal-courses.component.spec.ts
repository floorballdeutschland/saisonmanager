import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import {
  getTranslocoTestingModule,
  NotificationService,
  RefereeCourseSignupService,
} from '@floorball/core';
import { PortalCoursesResponse } from '@floorball/types';
import { RefereeCourseSignupSharedModule } from '../../referee-course-signup-shared.module';
import { offer, ownRegistration } from '../../spec-fixtures';
import { PortalCoursesComponent } from './portal-courses.component';

describe('PortalCoursesComponent', () => {
  function render(res: PortalCoursesResponse) {
    const service = jasmine.createSpyObj('RefereeCourseSignupService', [
      'portal',
      'portalRegister',
      'portalCancel',
    ]);
    service.portal.and.returnValue(of(res));
    service.portalRegister.and.returnValue(
      of(ownRegistration(9, { status: 'waitlisted' }))
    );
    const notify = jasmine.createSpyObj('NotificationService', ['success']);
    TestBed.configureTestingModule({
      imports: [RefereeCourseSignupSharedModule, getTranslocoTestingModule()],
      declarations: [PortalCoursesComponent],
      providers: [
        { provide: RefereeCourseSignupService, useValue: service },
        { provide: NotificationService, useValue: notify },
      ],
    });
    const fixture = TestBed.createComponent(PortalCoursesComponent);
    fixture.detectChanges();
    return { fixture, service, notify };
  }

  const base: PortalCoursesResponse = {
    own_state_association_id: 3,
    courses: [
      offer(1),
      offer(2, { state_association: { id: 9, name: 'NRW' } }),
      offer(3, { state_association: null }),
      offer(4, {
        state_association: { id: 9, name: 'NRW' },
        partner_state_association_ids: [3],
      }),
    ],
    registrations: [],
  };

  it('zeigt standardmaessig nur Kurse des eigenen LV, bundesweite und Partnerkurse', () => {
    const { fixture } = render(base);
    const c = fixture.componentInstance;
    expect(c.visibleCourses.map((x) => x.id)).toEqual([1, 3, 4]);
    c.onlyOwn = false;
    expect(c.visibleCourses.length).toBe(4);
  });

  it('meldet erst an, wenn die Pflichtfelder ausgefuellt sind', () => {
    const { fixture, service, notify } = render(base);
    const c = fixture.componentInstance;
    const course = c.courses[0];
    c.open(course);
    expect(c.answers.desired_license_level_id).toBe(2);
    expect(c.missing(course)).toEqual(['T-Shirt']);
    c.register(course);
    expect(service.portalRegister).not.toHaveBeenCalled();

    c.answers = {
      ...c.answers,
      custom_answers: { '11': 'M' },
    };
    c.register(course);
    expect(service.portalRegister).toHaveBeenCalledWith(1, {
      desired_license_level_id: 2,
      remarks: '',
      custom_answers: { '11': 'M' },
    });
    expect(notify.success).toHaveBeenCalledWith('courseSignup.waitlisted');
  });

  it('warnt vor der Abmeldung nach der Frist', () => {
    const res = {
      ...base,
      courses: [offer(1, { cancellation_deadline: '2020-01-01T00:00:00Z' })],
      registrations: [ownRegistration(5)],
    };
    const { fixture } = render(res);
    expect(
      fixture.componentInstance.lateCancellation(res.registrations[0])
    ).toBeTrue();
  });

  it('zeigt einen Kurs mit eigener Anmeldung als angemeldet', () => {
    const { fixture } = render({
      ...base,
      courses: [offer(1, { my_registration_id: 5 })],
    });
    expect(
      fixture.nativeElement.querySelector('[data-test="already"]')
    ).not.toBeNull();
  });
});
