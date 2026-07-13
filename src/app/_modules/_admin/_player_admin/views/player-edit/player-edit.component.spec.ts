import { TestBed } from '@angular/core/testing';

import { PlayerEditComponent } from './player-edit.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { getTranslocoTestingModule } from '@floorball/core';
import { RouterTestingModule } from '@angular/router/testing';
import { Player, PlayerLicense, Season } from '@floorball/models';

describe('PlayerEditComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [PlayerEditComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(PlayerEditComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  describe('licenseSeasonGroups', () => {
    function license(id: string, seasonId?: number | string): PlayerLicense {
      return {
        id,
        team_id: 1,
        history: [],
        season_id: seasonId,
        league_class_id: '',
        requested_at: '',
      } as PlayerLicense;
    }

    function build(): PlayerEditComponent {
      const component =
        TestBed.createComponent(PlayerEditComponent).componentInstance;
      component.seasons = [
        { id: 17, name: '2025/2026', current: false },
        { id: 18, name: '2026/2027', current: true },
        { id: 16, name: '2024/2025', current: false },
      ] as Season[];
      component.currentSeasonId = 18;
      return component;
    }

    it('groups by season, current first then descending, no-season last', () => {
      const component = build();
      component.player = {
        licenses: [
          license('a', 17),
          license('b', 18),
          license('c', undefined),
          license('d', 16),
        ],
      } as Player;

      const groups = component.licenseSeasonGroups();

      expect(groups.map((g) => g.seasonId)).toEqual([
        '18',
        '17',
        '16',
        undefined,
      ]);
      expect(groups[0].current).toBe(true);
      expect(groups[0].name).toBe('2026/2027');
      expect(groups[3].name).toBe('');
    });

    it('collects multiple licenses of the same season into one group', () => {
      const component = build();
      component.player = {
        licenses: [license('a', 18), license('b', 18)],
      } as Player;

      const groups = component.licenseSeasonGroups();

      expect(groups.length).toBe(1);
      expect(groups[0].licenses.map((l) => l.id)).toEqual(['a', 'b']);
    });

    it('marks only current-season licenses as editable', () => {
      const component = build();

      expect(component.isCurrentSeasonLicense(license('a', 18))).toBe(true);
      expect(component.isCurrentSeasonLicense(license('b', 17))).toBe(false);
      expect(component.isCurrentSeasonLicense(license('c', undefined))).toBe(
        false
      );
    });
  });
});
