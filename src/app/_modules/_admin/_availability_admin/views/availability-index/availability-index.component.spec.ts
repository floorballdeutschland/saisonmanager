import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import {
  getTranslocoTestingModule,
  NotificationService,
  RefereeService,
  SettingsService,
} from '@floorball/core';
import {
  RefereeAvailabilityReferee,
  RefereeAvailabilityWeekend,
} from '@floorball/types';
import { UikitCommonModule } from '@floorball/uikit/common';
import { AvailabilityIndexComponent } from './availability-index.component';

// Die Wochenend-Matrix. Gastschiedsrichter stehen seit api#633 darin — sie
// können aber strukturell keine Verfügbarkeit hinterlegen (kein
// Selbstverwaltungskonto). In den Summen unter den Wochenenden hätten sie
// deshalb jede Spalte „nicht verfügbar" dauerhaft angehoben, ohne dass jemand
// etwas versäumt hätte.

const WOCHENENDE: RefereeAvailabilityWeekend = {
  key: '2026-09-12',
  saturday: '2026-09-12',
  sunday: '2026-09-13',
  game_count: 4,
};

function schiri(
  overrides: Partial<RefereeAvailabilityReferee> = {}
): RefereeAvailabilityReferee {
  return {
    id: 1,
    lizenznummer: 100,
    vorname: 'Tom',
    nachname: 'Meier',
    lizenzstufe: 'C',
    states: {},
    ...overrides,
  } as RefereeAvailabilityReferee;
}

describe('AvailabilityIndexComponent', () => {
  let component: AvailabilityIndexComponent;

  beforeEach(() => {
    const refereeService = jasmine.createSpyObj('RefereeService', [
      'adminGetAvailabilityMatrix',
    ]);
    const settingsService = jasmine.createSpyObj('SettingsService', [
      'getSeasons',
    ]);
    settingsService.getSeasons.and.returnValue(
      of({ seasons: [], current_season_id: 17 } as never)
    );

    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        FormsModule,
        UikitCommonModule,
        getTranslocoTestingModule(),
      ],
      declarations: [AvailabilityIndexComponent],
      providers: [
        { provide: RefereeService, useValue: refereeService },
        { provide: SettingsService, useValue: settingsService },
        {
          provide: NotificationService,
          useValue: jasmine.createSpyObj('NotificationService', [
            'success',
            'error',
          ]),
        },
      ],
    });
    component = TestBed.createComponent(
      AvailabilityIndexComponent
    ).componentInstance;
    component.weekends = [WOCHENENDE];
  });

  describe('Summen unter den Wochenenden', () => {
    it('zählt einen Gast nicht als „nicht verfügbar"', () => {
      component.referees = [
        schiri({ id: 1 }),
        schiri({ id: 2, guest: true, lizenzstufe: undefined }),
      ];
      component.licenseLevels = ['C'];
      component.selectedLevels = new Set(['C']);

      // Öffentlicher Weg in die Neuberechnung: Der Stufenfilter.
      component.toggleLevel('C');
      component.toggleLevel('C');

      // Der Gast steht in der Liste …
      expect(component.displayReferees.map((r) => r.id)).toEqual([1, 2]);
      // … aber nur der reguläre Schiedsrichter in der Summe.
      expect(component.totals['2026-09-12'].unavailable).toBe(1);
    });

    it('zählt die Zustände der regulären Schiedsrichter vollständig', () => {
      component.referees = [
        schiri({ id: 1, states: { '2026-09-12': 'available' } }),
        schiri({ id: 2, states: { '2026-09-12': 'assigned' } }),
        schiri({ id: 3 }),
      ];
      component.licenseLevels = ['C'];
      component.selectedLevels = new Set(['C']);

      component.toggleLevel('C');
      component.toggleLevel('C');

      expect(component.totals['2026-09-12']).toEqual({
        available: 1,
        assigned: 1,
        unavailable: 1,
      });
    });
  });
});
