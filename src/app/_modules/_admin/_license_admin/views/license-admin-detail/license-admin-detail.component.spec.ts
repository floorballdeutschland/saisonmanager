import { TestBed } from '@angular/core/testing';

import { LicenseAdminDetailComponent } from './license-admin-detail.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { getTranslocoTestingModule } from '@floorball/core';
import {
  League,
  PlayerLicense,
  PlayerOtherLicense,
  PlayerWithLicense,
} from '@floorball/types';

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

  describe('gf role default on init', () => {
    function setup(
      others: Partial<PlayerOtherLicense>[]
    ): LicenseAdminDetailComponent {
      const fixture = TestBed.createComponent(LicenseAdminDetailComponent);
      const component = fixture.componentInstance;
      component.league = {
        field_size: 'GF',
        age_group: 'Herren',
        female: false,
      } as League;
      component.player = {
        team_license: { license: { id: 'new' } },
        other_licenses: others.map(
          (o) => ({ gf_adult: true, female: false, ...o }) as PlayerOtherLicense
        ),
      } as unknown as PlayerWithLicense;
      component.ngOnInit();
      return component;
    }

    it('proposes Erstlizenz when the other GF license is only applied for', () => {
      // Der gemeldete Fall: die andere Lizenz ist selbst noch nicht erteilt,
      // diese hier wird also die erste erteilte.
      const component = setup([{ last_status_id: 2, gf_role: null }]);

      expect(component.gfRoles['new']).toBe('erstlizenz');
    });

    it('proposes Zweitlizenz when an unassigned other GF license is already granted', () => {
      // Der Regelfall der zweiten Lizenz: die erteilte Lizenz ist die
      // naheliegende Erstlizenz und darf nicht herabgestuft werden.
      const component = setup([{ last_status_id: 1, gf_role: null }]);

      expect(component.gfRoles['new']).toBe('zweitlizenz');
    });

    it('proposes Zweitlizenz when the other GF license is the Erstlizenz', () => {
      const component = setup([{ last_status_id: 1, gf_role: 'erstlizenz' }]);

      expect(component.gfRoles['new']).toBe('zweitlizenz');
    });

    it('proposes Erstlizenz when the other GF license is the Zweitlizenz', () => {
      const component = setup([{ last_status_id: 1, gf_role: 'zweitlizenz' }]);

      expect(component.gfRoles['new']).toBe('erstlizenz');
    });

    it('weighs every partner, not just the first one listed', () => {
      // apply_gf_role bucht auf der API-Seite jede Partner-Lizenz gegen, die
      // Vorbelegung muss also alle betrachten.
      const component = setup([
        { last_status_id: 2, gf_role: null },
        { last_status_id: 1, gf_role: 'erstlizenz' },
      ]);

      expect(component.gfRoles['new']).toBe('zweitlizenz');
    });

    it('makes no proposal without another GF license in the competition', () => {
      const component = setup([]);

      expect(component.gfRoles['new']).toBeUndefined();
      expect(component.gfRoleSelectable()).toBe(false);
    });

    it('ignores licenses of the other competition', () => {
      const component = setup([{ last_status_id: 1, female: true }]);

      expect(component.gfRoleSelectable()).toBe(false);
    });

    it('warns about the demotion whenever a partner is not yet the Zweitlizenz', () => {
      const granted = setup([{ last_status_id: 1, gf_role: null }]);
      granted.gfRoles['new'] = 'erstlizenz';
      expect(granted.gfRoleDemotesPartners('new')).toBe(true);

      const alreadySecond = setup([
        { last_status_id: 1, gf_role: 'zweitlizenz' },
      ]);
      expect(alreadySecond.gfRoles['new']).toBe('erstlizenz');
      expect(alreadySecond.gfRoleDemotesPartners('new')).toBe(false);
    });

    it('names the status of the other license so a mere application is visible', () => {
      expect(setup([{ last_status_id: 2 }]).otherGfLicenseStatusKey()).toBe(
        'licenseAdmin.detail.gfRoleOtherRequested'
      );
      expect(setup([{ last_status_id: 1 }]).otherGfLicenseStatusKey()).toBe(
        'licenseAdmin.detail.gfRoleOtherApproved'
      );
      expect(setup([{}]).otherGfLicenseStatusKey()).toBe(
        'licenseAdmin.detail.gfRoleOtherUnknown'
      );
    });
  });
});
