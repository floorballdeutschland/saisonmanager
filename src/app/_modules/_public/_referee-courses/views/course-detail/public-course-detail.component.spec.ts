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
  RefereeCourseSignupService,
} from '@floorball/core';
import { RefereeCourseSignupSharedModule } from '@floorball/referee-course-signup';
import { RefereeCourseOffer } from '@floorball/types';
import { PublicCourseDetailComponent } from './public-course-detail.component';

const OFFER = {
  id: 7,
  title: 'G-Kurs Kassel',
  course_type: 'g',
  format: 'in_person',
  status: 'published',
  registration_mode: 'open',
  state_association: { id: 3, name: 'Hessen' },
  partner_state_association_ids: [],
  hosting_club: null,
  starts_on: '2026-11-21',
  ends_on: '2026-11-21',
  sessions: [],
  online_platform: null,
  min_participants: null,
  max_participants: 10,
  free_seats: 4,
  registration_opens_at: null,
  registration_deadline: null,
  cancellation_deadline: null,
  registration_closed_reason: null,
  min_age: null,
  fee_member_cents: 2500,
  fee_non_member_cents: null,
  fee_only_on_license: false,
  fee_note: null,
  prerequisites_note: null,
  contact_email: null,
  description: null,
  license_levels: [{ id: 2, name: 'L3' }],
  fields: [],
} as RefereeCourseOffer;

describe('PublicCourseDetailComponent', () => {
  function render(offer: RefereeCourseOffer | null = OFFER) {
    const service = jasmine.createSpyObj('RefereeCourseSignupService', [
      'publicCourse',
      'publicClubs',
      'publicRegister',
    ]);
    service.publicCourse.and.returnValue(
      offer ? of(offer) : throwError(() => ({ status: 404 }))
    );
    service.publicClubs.and.returnValue(
      of([
        { id: 1, name: 'Zebras Berlin', state_association_id: 9 },
        { id: 2, name: 'TV Kassel', state_association_id: 3 },
      ])
    );
    service.publicRegister.and.returnValue(of({ status: 'pending_email' }));
    TestBed.configureTestingModule({
      imports: [
        FormsModule,
        RefereeCourseSignupSharedModule,
        getTranslocoTestingModule(),
      ],
      declarations: [PublicCourseDetailComponent],
      providers: [
        provideRouter([]),
        { provide: RefereeCourseSignupService, useValue: service },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: '7' }) } },
        },
      ],
    });
    const fixture = TestBed.createComponent(PublicCourseDetailComponent);
    fixture.detectChanges();
    return { fixture, service };
  }

  function fill(c: PublicCourseDetailComponent) {
    c.vorname = 'Neu';
    c.nachname = 'Ling';
    c.geburtsdatum = '2000-03-04';
    c.email = 'neu@example.org';
  }

  it('sortiert Vereine des Kurs-LV nach vorn', () => {
    const { fixture } = render();
    expect(fixture.componentInstance.sortedClubs.map((c) => c.id)).toEqual([
      2, 1,
    ]);
  });

  it('verlangt die Einwilligung in die Datenverarbeitung', () => {
    const { fixture, service } = render();
    const c = fixture.componentInstance;
    fill(c);
    expect(c.valid).toBeFalse();
    c.consent = true;
    expect(c.valid).toBeTrue();
    c.submit();
    const payload = service.publicRegister.calls.mostRecent().args[1];
    expect(payload.consent).toBeTrue();
    expect(payload.club_id).toBeNull();
    expect(payload.lizenznummer).toBeNull();
    expect(c.state).toBe('sent');
  });

  it('fragt unter 16 immer nach den Erziehungsberechtigten, auch mit Lizenznummer', () => {
    const { fixture } = render();
    const c = fixture.componentInstance;
    fill(c);
    c.consent = true;
    c.geburtsdatum = '2014-01-01';
    expect(c.needsGuardian).toBeTrue();
    expect(c.valid).toBeFalse();
    c.lizenznummer = '4711';
    expect(c.needsGuardian).toBeTrue();
    c.guardianName = 'Eva';
    c.guardianEmail = 'eva@example.org';
    expect(c.valid).toBeTrue();
  });

  it('zeigt Fehlermeldungen der API im Klartext', () => {
    const { fixture, service } = render();
    const c = fixture.componentInstance;
    fill(c);
    c.consent = true;
    service.publicRegister.and.returnValue(
      throwError(() => ({
        status: 422,
        error: { error: 'Der Anmeldeschluss ist vorbei' },
      }))
    );
    c.submit();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[data-test="error"]').textContent
    ).toContain('Der Anmeldeschluss ist vorbei');
  });

  it('zeigt den Grund, wenn die Anmeldung geschlossen ist', () => {
    const { fixture } = render({
      ...OFFER,
      registration_closed_reason: 'Der Anmeldeschluss ist vorbei',
    });
    expect(
      fixture.nativeElement.querySelector('[data-test="closed"]').textContent
    ).toContain('Anmeldeschluss');
    expect(
      fixture.nativeElement.querySelector('[data-test="form"]')
    ).toBeNull();
  });

  it('meldet einen unbekannten Kurs', () => {
    const { fixture } = render(null);
    expect(
      fixture.nativeElement.querySelector('[data-test="missing"]')
    ).not.toBeNull();
  });
});
