import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { of } from 'rxjs';
import {
  ClubService,
  getTranslocoTestingModule,
  NotificationService,
  RefereeCourseService,
  RefereeService,
} from '@floorball/core';
import {
  RefereeCourse,
  RefereeCourseOptions,
  RefereeCourseRegistration,
} from '@floorball/types';
import { CourseDetailComponent } from './course-detail.component';
import { CourseFieldEditorComponent } from '../../components/course-field-editor/course-field-editor.component';

const COURSE = {
  id: 7,
  title: 'F-Kurs Mainz',
  course_type: 'f',
  format: 'in_person',
  status: 'published',
  registration_mode: 'open',
  state_association: { id: 3, name: 'Hessen' },
  partner_state_association_ids: [],
  starts_on: '2026-11-21',
  ends_on: '2026-11-21',
  min_participants: 3,
  max_participants: 2,
  registration_deadline: null,
  public: true,
  license_level_ids: [2],
  sessions: [],
  fields: [
    {
      id: 11,
      label: 'T-Shirt',
      field_type: 'select',
      options: ['S', 'M'],
      required: false,
      visible_to_lead: true,
      include_in_billing_export: false,
    },
  ],
  leads: [],
  free_seats: 1,
  fee_member_cents: 2500,
  fee_non_member_cents: null,
} as unknown as RefereeCourse;

const OPTIONS = {
  state_associations: [{ id: 3, name: 'Hessen' }],
  partner_state_associations: [],
  national_allowed: false,
  license_levels: [
    { id: 1, name: 'L1' },
    { id: 2, name: 'L2' },
  ],
  course_types: ['f'],
} as RefereeCourseOptions;

function reg(
  id: number,
  status: string,
  extra: Partial<RefereeCourseRegistration> = {}
): RefereeCourseRegistration {
  return {
    id,
    vorname: `V${id}`,
    nachname: `N${id}`,
    geburtsdatum: '2000-01-01',
    status,
    custom_answers: {},
    club: null,
    billing_club: null,
    referee_id: null,
    lizenznummer: null,
    points: null,
    result: null,
    awarded_license_level_id: null,
    desired_license_level_id: null,
    fee_cents: 2500,
    ...extra,
  } as unknown as RefereeCourseRegistration;
}

describe('CourseDetailComponent', () => {
  function render(
    registrations: RefereeCourseRegistration[],
    course: RefereeCourse = COURSE
  ) {
    const service = jasmine.createSpyObj('RefereeCourseService', [
      'get',
      'options',
      'listRegistrations',
      'update',
      'createRegistration',
      'updateRegistration',
    ]);
    service.get.and.returnValue(of(course));
    service.options.and.returnValue(of(OPTIONS));
    service.listRegistrations.and.returnValue(of(registrations));
    service.update.and.callFake((_id: number, patch: object) =>
      of({ ...COURSE, ...patch })
    );
    service.updateRegistration.and.callFake(
      (_c: number, id: number, patch: object) =>
        of({ ...registrations.find((r) => r.id === id), ...patch })
    );
    service.createRegistration.and.returnValue(of(reg(99, 'waitlisted')));
    const notify = jasmine.createSpyObj('NotificationService', [
      'success',
      'warning',
    ]);
    TestBed.configureTestingModule({
      imports: [FormsModule, getTranslocoTestingModule()],
      declarations: [CourseDetailComponent, CourseFieldEditorComponent],
      providers: [
        provideRouter([]),
        { provide: RefereeCourseService, useValue: service },
        {
          provide: RefereeService,
          useValue: jasmine.createSpyObj('RefereeService', ['adminGetAll']),
        },
        {
          provide: ClubService,
          useValue: jasmine.createSpyObj('ClubService', {
            getAdminClubAll: of([]),
          }),
        },
        { provide: NotificationService, useValue: notify },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: '7' }) } },
        },
      ],
    });
    const fixture = TestBed.createComponent(CourseDetailComponent);
    fixture.detectChanges();
    return { fixture, service, notify };
  }

  const el = (root: HTMLElement, test: string) =>
    root.querySelector(`[data-test="${test}"]`);

  it('zeigt nur die erlaubten Statuswechsel', () => {
    const { fixture } = render([]);
    const root = fixture.nativeElement;
    expect(el(root, 'to-registration_closed')).not.toBeNull();
    expect(el(root, 'to-held')).not.toBeNull();
    expect(el(root, 'to-results_submitted')).toBeNull();
  });

  it('zaehlt belegte Plaetze und blendet Abgemeldete aus', () => {
    const { fixture } = render([
      reg(1, 'registered'),
      reg(2, 'waitlisted'),
      reg(3, 'cancelled_by_organizer'),
    ]);
    const c = fixture.componentInstance;
    expect(c.seated).toBe(1);
    expect(c.visibleRegistrations.length).toBe(2);
    expect(c.cancelledCount).toBe(1);
  });

  it('meldet die Warteliste beim Hinzufuegen', () => {
    const { fixture, notify, service } = render([
      reg(1, 'registered'),
      reg(2, 'registered'),
    ]);
    const c = fixture.componentInstance;
    expect(c.full).toBeTrue();
    c.openAdd('person');
    c.newPerson = {
      vorname: 'Ada',
      nachname: 'Muster',
      geburtsdatum: '2010-02-03',
      email: '',
      club_id: null,
      desired_license_level_id: 2,
    };
    c.addPerson();

    const payload = service.createRegistration.calls.mostRecent().args[1];
    expect(payload.email).toBeNull();
    expect(payload.desired_license_level_id).toBe(2);
    expect(notify.warning).toHaveBeenCalled();
    expect(c.registrations.length).toBe(3);
  });

  it('nimmt Punkte mit Komma an und ignoriert Unsinn', () => {
    const r = reg(1, 'attended');
    const { fixture, service } = render([r]);
    const c = fixture.componentInstance;
    c.pointsChanged(r, '27,5');
    expect(service.updateRegistration.calls.mostRecent().args[2]).toEqual({
      points: 27.5,
    });
    service.updateRegistration.calls.reset();
    c.pointsChanged(r, 'abc');
    expect(service.updateRegistration).not.toHaveBeenCalled();
  });

  it('zeigt Antworten auf Zusatzfelder', () => {
    const { fixture } = render([
      reg(1, 'registered', { custom_answers: { '11': 'M' } }),
    ]);
    expect(fixture.nativeElement.textContent).toContain('T-Shirt: M');
  });

  it('bietet das Einreichen nur bei durchgefuehrtem Kurs und ohne offene Punkte', () => {
    const { fixture } = render([], {
      ...COURSE,
      status: 'held',
      submission_problems: ['Anwesenheit fehlt bei: A B'],
    });
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('[data-test="problems"]')).not.toBeNull();
    expect(
      (root.querySelector('[data-test="submit-results"]') as HTMLButtonElement)
        .disabled
    ).toBeTrue();
    expect(fixture.componentInstance.transitions).not.toContain(
      'results_submitted'
    );
  });
});
