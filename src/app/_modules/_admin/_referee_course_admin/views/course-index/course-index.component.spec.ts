import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import {
  getTranslocoTestingModule,
  RefereeCourseService,
} from '@floorball/core';
import { RefereeCourseSummary } from '@floorball/types';
import { CourseIndexComponent } from './course-index.component';

function course(
  id: number,
  extra: Partial<RefereeCourseSummary> = {}
): RefereeCourseSummary {
  return {
    id,
    title: `Kurs ${id}`,
    course_type: 'g',
    format: 'in_person',
    status: 'published',
    registration_mode: 'open',
    state_association: null,
    partner_state_association_ids: [],
    starts_on: '2026-11-21',
    ends_on: '2026-11-21',
    min_participants: null,
    max_participants: 20,
    registration_deadline: null,
    public: true,
    license_level_ids: [],
    taken_seats: 0,
    ...extra,
  };
}

describe('CourseIndexComponent', () => {
  function render(courses: RefereeCourseSummary[]) {
    const service = jasmine.createSpyObj('RefereeCourseService', [
      'list',
      'options',
    ]);
    service.list.and.returnValue(of(courses));
    service.options.and.returnValue(
      of({
        state_associations: [{ id: 3, name: 'Hessen' }],
        partner_state_associations: [],
        national_allowed: false,
        license_levels: [],
        course_types: [],
      })
    );
    TestBed.configureTestingModule({
      imports: [getTranslocoTestingModule()],
      declarations: [CourseIndexComponent],
      providers: [
        provideRouter([]),
        { provide: RefereeCourseService, useValue: service },
      ],
    });
    const fixture = TestBed.createComponent(CourseIndexComponent);
    fixture.detectChanges();
    return { fixture, service };
  }

  it('laedt standardmaessig nur kommende Kurse', () => {
    const { service, fixture } = render([]);
    expect(service.list.calls.mostRecent().args[0].from).toMatch(
      /^\d{4}-\d{2}-\d{2}$/
    );
    fixture.componentInstance.togglePast(true);
    expect(service.list.calls.mostRecent().args[0].from).toBeUndefined();
  });

  it('markiert Kurse unter der Mindestzahl, abgesagte nicht', () => {
    const { fixture } = render([
      course(1, { min_participants: 5, taken_seats: 2 }),
      course(2, { min_participants: 5, taken_seats: 5 }),
      course(3, { min_participants: 5, taken_seats: 0, status: 'cancelled' }),
    ]);
    expect(
      fixture.nativeElement.querySelectorAll('[data-test="below-minimum"]')
        .length
    ).toBe(1);
  });

  it('zeigt Link und iframe-Code fuer die Verbandsseite', () => {
    const { fixture } = render([]);
    const c = fixture.componentInstance;
    expect(c.publicUrl(3)).toMatch(/\/schiri-kurse\?verband=3$/);
    expect(c.embedCode(3)).toContain('/kurse-einbettung/?verband=3');
    expect(c.embedCode(3)).toContain('saisonmanager-kurse-hoehe');
    expect(
      fixture.nativeElement.querySelector('[data-test="embed"]')
    ).not.toBeNull();
  });
});
