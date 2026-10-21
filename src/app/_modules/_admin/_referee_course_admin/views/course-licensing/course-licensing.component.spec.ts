import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import {
  getTranslocoTestingModule,
  NotificationService,
  RefereeCourseService,
} from '@floorball/core';
import { CourseLicensingRow } from '@floorball/types';
import { CourseLicensingComponent } from './course-licensing.component';

function row(
  id: number,
  courseId: number,
  extra: Partial<CourseLicensingRow> = {}
): CourseLicensingRow {
  return {
    id,
    status: 'pending_review',
    lizenzstufe: null,
    gueltigkeit: null,
    rejection_reason: null,
    reviewed_at: null,
    new_referee_created: false,
    course: {
      id: courseId,
      title: `Kurs ${courseId}`,
      course_type: 'g',
      ends_on: '2026-11-21',
      state_association: 'Hessen',
      license_levels: ['L3'],
    },
    person: {
      vorname: 'P',
      nachname: `${id}`,
      geburtsdatum: '2000-01-01',
      email: null,
      club: null,
    },
    referee: null,
    registration: {
      id: id + 100,
      identity_match: 'new_person',
      match_candidates: [],
      desired_level: 'L3',
      test_version: 'A',
      points: 30,
      stated_lizenznummer: null,
      source: 'portal',
    },
    ...extra,
  };
}

describe('CourseLicensingComponent', () => {
  function render(rows: CourseLicensingRow[]) {
    const service = jasmine.createSpyObj('RefereeCourseService', [
      'options',
      'licensing',
      'licensingUpdate',
      'licensingApprove',
      'licensingApproveMany',
      'licensingReject',
    ]);
    service.options.and.returnValue(
      of({
        license_levels: [
          { id: 1, name: 'L3' },
          { id: 2, name: 'L2' },
        ],
      })
    );
    service.licensing.and.returnValue(of(rows));
    service.licensingUpdate.and.callFake(
      (id: number, patch: { lizenzstufe?: string }) =>
        of({ ...rows.find((r) => r.id === id)!, ...patch })
    );
    service.licensingApproveMany.and.returnValue(
      of({ results: [{ id: 1, ok: true }] })
    );
    service.licensingReject.and.returnValue(
      of({ ...rows[0], status: 'rejected', rejection_reason: 'x' })
    );
    TestBed.configureTestingModule({
      imports: [FormsModule, getTranslocoTestingModule()],
      declarations: [CourseLicensingComponent],
      providers: [
        provideRouter([]),
        { provide: RefereeCourseService, useValue: service },
        {
          provide: NotificationService,
          useValue: jasmine.createSpyObj('NotificationService', [
            'success',
            'error',
          ]),
        },
      ],
    });
    const fixture = TestBed.createComponent(CourseLicensingComponent);
    fixture.detectChanges();
    return { fixture, service };
  }

  it('gruppiert nach Kurs und schlaegt keine Stufe vor', () => {
    const { fixture } = render([row(1, 7), row(2, 7), row(3, 8)]);
    const c = fixture.componentInstance;
    expect(c.groups.map((g) => g.rows.length)).toEqual([2, 1]);
    expect(c.rows.every((r) => r.lizenzstufe === null)).toBeTrue();
    expect(c.ready(c.rows[0])).toBeFalse();
  });

  it('gibt nur Zeilen mit gewaehlter Stufe gesammelt frei', () => {
    const { fixture, service } = render([row(1, 7), row(2, 7)]);
    const c = fixture.componentInstance;
    c.setLevel(c.rows[0], 'L3');
    expect(service.licensingUpdate).toHaveBeenCalledWith(1, {
      lizenzstufe: 'L3',
    });
    c.toggle(c.rows[0], true);
    c.toggle(c.rows[1], true);
    expect(c.selectedReady).toEqual([1]);
    c.approveSelected();
    expect(service.licensingApproveMany).toHaveBeenCalledWith([1]);
  });

  it('lehnt nur mit Begruendung ab', () => {
    const { fixture, service } = render([row(1, 7)]);
    const c = fixture.componentInstance;
    spyOn(window, 'prompt').and.returnValues('  ', 'Voraussetzung fehlt');
    c.reject(c.rows[0]);
    expect(service.licensingReject).not.toHaveBeenCalled();
    c.reject(c.rows[0]);
    expect(service.licensingReject).toHaveBeenCalledWith(
      1,
      'Voraussetzung fehlt'
    );
  });
});
