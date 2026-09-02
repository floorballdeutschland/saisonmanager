import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NotificationService, RefereeService } from '@floorball/core';
import { RefereeGameDay } from '@floorball/types';
import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';

import { RefereeGameDaysComponent } from './referee-game-days.component';

function spieltag(overrides: Partial<RefereeGameDay> = {}): RefereeGameDay {
  return {
    id: 1,
    date: '2026-09-12',
    auto_confirmed: false,
    checklist_required: true,
    checklist_items: [],
    my_checklist_answers: [],
    games: [],
    ...overrides,
  } as RefereeGameDay;
}

describe('RefereeGameDaysComponent (Bestätigungsstatus)', () => {
  let component: RefereeGameDaysComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [getTranslocoTestingModule()],
      declarations: [RefereeGameDaysComponent],
      providers: [
        {
          provide: RefereeService,
          useValue: {
            getGameDays: jasmine.createSpy().and.returnValue(of([])),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            success: jasmine.createSpy(),
            error: jasmine.createSpy(),
          },
        },
      ],
    })
      .overrideTemplate(RefereeGameDaysComponent, '')
      .compileComponents();

    component = TestBed.createComponent(
      RefereeGameDaysComponent
    ).componentInstance;
  });

  it('meldet vor dem Freischaltzeitpunkt "not_yet" statt "pending"', () => {
    const inEinerWoche = new Date(Date.now() + 7 * 86400000).toISOString();

    expect(
      component.confirmationStatus(spieltag({ confirmable_from: inEinerWoche }))
    ).toBe('not_yet');
  });

  it('meldet ab dem Freischaltzeitpunkt "pending"', () => {
    const gestern = new Date(Date.now() - 86400000).toISOString();

    expect(
      component.confirmationStatus(spieltag({ confirmable_from: gestern }))
    ).toBe('pending');
  });

  it('meldet ohne Freischaltzeitpunkt "pending"', () => {
    expect(component.confirmationStatus(spieltag())).toBe('pending');
  });

  it('lässt bestätigte und automatisch bestätigte Spieltage unberührt', () => {
    const inEinerWoche = new Date(Date.now() + 7 * 86400000).toISOString();

    expect(
      component.confirmationStatus(
        spieltag({
          confirmable_from: inEinerWoche,
          my_confirmed_at: '2026-09-12T20:00:00Z',
        })
      )
    ).toBe('confirmed');
    expect(
      component.confirmationStatus(
        spieltag({
          confirmable_from: inEinerWoche,
          my_confirmed_at: '2026-09-12T20:00:00Z',
          properly_conducted: false,
        })
      )
    ).toBe('not_ok');
    expect(
      component.confirmationStatus(
        spieltag({ confirmable_from: inEinerWoche, auto_confirmed: true })
      )
    ).toBe('auto');
  });
});
