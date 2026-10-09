import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { of } from 'rxjs';
import {
  getTranslocoTestingModule,
  NotificationService,
  RefereeCourseService,
} from '@floorball/core';
import { RefereeCourseOptions } from '@floorball/types';
import { CourseEditComponent } from './course-edit.component';

const OPTIONS: RefereeCourseOptions = {
  state_associations: [{ id: 3, name: 'Hessen' }],
  partner_state_associations: [
    { id: 3, name: 'Hessen' },
    { id: 4, name: 'RLP/Saar' },
  ],
  national_allowed: false,
  license_levels: [
    { id: 1, name: 'L1' },
    { id: 2, name: 'L2' },
  ],
  course_types: ['g', 'f'],
};

describe('CourseEditComponent', () => {
  function render(id: string | null = null, course: object | null = null) {
    const service = jasmine.createSpyObj('RefereeCourseService', [
      'options',
      'get',
      'create',
      'update',
    ]);
    service.options.and.returnValue(of(OPTIONS));
    service.get.and.returnValue(of(course));
    service.update.and.returnValue(of({ id: 9 }));
    service.create.and.returnValue(of({ id: 9 }));
    TestBed.configureTestingModule({
      imports: [FormsModule, getTranslocoTestingModule()],
      declarations: [CourseEditComponent],
      providers: [
        provideRouter([]),
        { provide: RefereeCourseService, useValue: service },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap(id ? { id } : {}) },
          },
        },
        {
          provide: NotificationService,
          useValue: jasmine.createSpyObj('NotificationService', ['success']),
        },
      ],
    });
    const fixture = TestBed.createComponent(CourseEditComponent);
    fixture.detectChanges();
    return { fixture, service };
  }

  it('waehlt den einzigen LV vor und laesst ihn nicht als Partner zu', () => {
    const { fixture } = render();
    const c = fixture.componentInstance;
    expect(c.stateAssociationId).toBe(3);
    expect(c.partnerOptions.map((s) => s.id)).toEqual([4]);
  });

  it('baut den Payload mit Cent-Betraegen und ISO-Zeiten', () => {
    const { fixture, service } = render();
    const c = fixture.componentInstance;
    c.title = 'F-Kurs Mainz';
    c.courseType = 'f';
    c.licenseLevelIds = [2, 1];
    c.sessions[0].starts_at = '2026-11-21T09:00';
    c.sessions[0].location = 'Halle Nord';
    c.feeMember = '15';
    c.feeNonMember = '30,00';
    c.save();

    const payload = service.create.calls.mostRecent().args[0];
    expect(payload.fee_member_cents).toBe(1500);
    expect(payload.fee_non_member_cents).toBe(3000);
    expect(payload.state_association_id).toBe(3);
    expect(payload.sessions[0].location).toBe('Halle Nord');
    expect(new Date(payload.sessions[0].starts_at).getHours()).toBe(9);
    expect(payload.bill_state_association).toBeFalse();
  });

  it('speichert nicht mit ungueltigem Betrag oder ohne Termin', () => {
    const { fixture } = render();
    const c = fixture.componentInstance;
    c.title = 'x';
    c.sessions[0].starts_at = '2026-11-21T09:00';
    c.feeMember = 'zehn';
    expect(c.valid).toBeFalse();
    c.feeMember = '10';
    c.sessions[0].starts_at = '';
    expect(c.valid).toBeFalse();
  });

  it('schlaegt Fristen relativ zum ersten Termin vor', () => {
    const { fixture } = render();
    const c = fixture.componentInstance;
    c.sessions = [
      { ...c.sessions[0], starts_at: '2026-11-21T09:00' },
      { ...c.sessions[0], starts_at: '2026-11-14T09:00' },
    ];
    c.suggestDeadlines();
    expect(c.registrationDeadline).toBe('2026-10-31T23:59');
    expect(c.cancellationDeadline).toBe('2026-11-07T23:59');
  });

  it('Partner-LV: verantwortlicher LV bleibt sichtbar, wird aber nicht mitgeschickt', () => {
    const { fixture, service } = render('9', {
      id: 9,
      title: 'Gemeinsamer Kurs',
      course_type: 'g',
      state_association: { id: 7, name: 'Fremd-LV' },
      partner_state_association_ids: [3],
      license_level_ids: [],
      format: 'in_person',
      sessions: [{ starts_at: '2026-11-21T09:00:00+01:00' }],
      registration_mode: 'open',
      public: true,
      fee_only_on_license: false,
      no_show_billable: false,
      bill_state_association: false,
    });
    const c = fixture.componentInstance;
    expect(c.stateAssociationChoices[0]).toEqual(
      jasmine.objectContaining({ id: 7, locked: true })
    );
    expect(c.stateAssociationLocked).toBeTrue();
    expect(c.valid).toBeTrue();
    c.save();
    const payload = service.update.calls.mostRecent().args[1];
    expect('state_association_id' in payload).toBeFalse();
    expect('partner_state_association_ids' in payload).toBeFalse();
  });
});
