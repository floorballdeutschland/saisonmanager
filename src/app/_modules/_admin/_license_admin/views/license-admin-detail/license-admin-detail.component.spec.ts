import { TestBed } from '@angular/core/testing';

import { LicenseAdminDetailComponent } from './license-admin-detail.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { getTranslocoTestingModule } from '@floorball/core';
import { League, PlayerLicense, PlayerWithLicense } from '@floorball/types';

describe('LicenseAdminDetailComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [LicenseAdminDetailComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(LicenseAdminDetailComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  describe('currentSeasonLicenses', () => {
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

    function setup(
      licenses: PlayerLicense[],
      seasonId?: string
    ): LicenseAdminDetailComponent {
      const fixture = TestBed.createComponent(LicenseAdminDetailComponent);
      const component = fixture.componentInstance;
      component.player = { licenses } as PlayerWithLicense;
      component.league = seasonId
        ? ({ season_id: seasonId } as League)
        : undefined;
      return component;
    }

    it('keeps only licenses matching the viewed league season (int/string agnostic)', () => {
      const current = license('a', 18);
      const other = license('b', 17);
      const component = setup([current, other], '18');

      expect(component.currentSeasonLicenses()).toEqual([current]);
    });

    it('drops legacy licenses without a season_id', () => {
      const current = license('a', 18);
      const legacy = license('b', undefined);
      const component = setup([current, legacy], '18');

      expect(component.currentSeasonLicenses()).toEqual([current]);
    });

    it('falls back to all licenses when the league season is unknown', () => {
      const licenses = [license('a', 18), license('b', undefined)];
      const component = setup(licenses);

      expect(component.currentSeasonLicenses()).toEqual(licenses);
    });
  });
});
