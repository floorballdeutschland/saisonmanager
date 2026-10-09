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
  function render() {
    const service = jasmine.createSpyObj('RefereeCourseService', [
      'options',
      'get',
      'create',
      'update',
    ]);
    service.options.and.returnValue(of(OPTIONS));
    service.create.and.returnValue(of({ id: 9 }));
    TestBed.configureTestingModule({
      imports: [FormsModule, getTranslocoTestingModule()],
      declarations: [CourseEditComponent],
      providers: [
        provideRouter([]),
        { provide: RefereeCourseService, useValue: service },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({}) } },
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
});
