import { TestBed } from '@angular/core/testing';

import { LicenseAdminDetailComponent } from './license-admin-detail.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { FormsModule } from '@angular/forms';
import { getTranslocoTestingModule } from '@floorball/core';
import { UikitCommonModule } from '@floorball/uikit/common';
import { UikitPlayerModule } from '@floorball/uikit/player';
import {
  GenderKey,
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

  // Die Elternzustimmung hängt an der Liga, nicht am Geburtsdatum allein:
  // vorher galt eine Lizenz einer minderjährigen Person bundesweit als
  // unvollständig, auch in Ligen ohne diese Pflicht.
  describe('Elternzustimmung', () => {
    function setup(
      requiredDocuments: string[] | undefined,
      league: Partial<League>
    ): LicenseAdminDetailComponent {
      const fixture = TestBed.createComponent(LicenseAdminDetailComponent);
      const component = fixture.componentInstance;
      component.league = league as League;
      component.player = {
        birthdate: '2012-05-04',
        team_license: {
          license: { id: 'l1' },
          required_documents: requiredDocuments,
          documents: { parental_consent: false },
        },
      } as unknown as PlayerWithLicense;
      return component;
    }

    it('verlangt sie, wenn die Liga sie fordert', () => {
      const component = setup(['parental_consent'], {});

      expect(component.needsParentalConsent()).toBe(true);
      expect(component.isDocumentsComplete(component.player)).toBe(false);
    });

    it('verlangt sie nicht ohne Liga-Pflicht, auch bei Minderjährigen', () => {
      const component = setup([], {});

      expect(component.needsParentalConsent()).toBe(false);
      expect(component.isDocumentsComplete(component.player)).toBe(true);
    });

    // Ohne serverseitig aufgelöste Liste darf die Prüfung die Zustimmung nicht
    // verlieren, sonst gilt eine unvollständige Lizenz als genehmigungsreif.
    it('greift ohne aufgelöste Liste auf das Liga-Flag zurück', () => {
      const component = setup(undefined, { parental_consent_required: true });

      expect(component.needsParentalConsent()).toBe(true);
      expect(component.isDocumentsComplete(component.player)).toBe(false);
    });
  });
  // Vor der Genehmigung soll erkennbar sein, wie frisch das vorliegende
  // Dokument ist. Der Genehmigungsdialog liest dafür einen anderen Pfad als die
  // Verbandsliste (player.team_license.documents statt entry.documents).
  describe('Uploadzeitpunkt der Dokumente', () => {
    function withDocuments(
      documents: Record<string, unknown> | undefined
    ): LicenseAdminDetailComponent {
      const component = TestBed.createComponent(LicenseAdminDetailComponent)
        .componentInstance;
      component.player = {
        team_license: { documents },
      } as unknown as PlayerWithLicense;
      return component;
    }

    it('liefert den Uploadzeitpunkt einer Dokumentart', () => {
      const component = withDocuments({
        id_copy: true,
        id_copy_url: 'https://example.test/doc.pdf',
        id_copy_uploaded_at: '2026-08-12T09:30:00.000Z',
      });

      expect(component.docUploadedAt('id_copy')).toBe(
        '2026-08-12T09:30:00.000Z'
      );
    });

    // Ältere Serverantworten kennen das Feld nicht; der Dialog bleibt dann beim
    // reinen Label statt eine Lücke zu zeigen.
    it('bleibt ohne Zeitpunkt bei null', () => {
      expect(
        withDocuments({ id_copy: true, id_copy_url: 'x' }).docUploadedAt(
          'id_copy'
        )
      ).toBeNull();
      expect(withDocuments(undefined).docUploadedAt('id_copy')).toBeNull();
    });

    it('reicht einen booleschen Wert nicht als Zeitpunkt durch', () => {
      expect(
        withDocuments({ id_copy: true, id_copy_uploaded_at: true }).docUploadedAt(
          'id_copy'
        )
      ).toBeNull();
    });
  });

  // Das Geschlecht liegt im Payload (Player#full_hash) und stand in der
  // Antragsmaske trotzdem nicht. Ein Getter-Test würde das nicht bemerken:
  // Die Angabe hängt allein am Template.
  describe('Geschlecht in der Antragsmaske', () => {
    function render(gender: GenderKey): HTMLElement {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [
          HttpClientTestingModule,
          RouterTestingModule,
          // Das Template braucht die gender-Pipe aus dem Player-UIKit, den
          // additionalClubFilter aus dem gemeinsamen UIKit und ngModel für die
          // Entscheidungsfelder. Die Getter-Specs oben rendern nicht.
          UikitPlayerModule,
          UikitCommonModule,
          FormsModule,
          getTranslocoTestingModule({
            de: { licenseAdmin: { detail: { gender: 'Geschlecht' } } },
          }),
        ],
        declarations: [LicenseAdminDetailComponent],
      });
      const fixture = TestBed.createComponent(LicenseAdminDetailComponent);
      const component = fixture.componentInstance;
      component.initiallyOpen = true;
      component.allClubs = [];
      component.player = {
        id: 1,
        first_name: 'Mia',
        last_name: 'Muster',
        birthdate: '2000-05-01',
        gender,
        clubs: [],
        licenses: [],
        team_license: {
          license: { id: 'l1', team_id: 1, history: [] },
          last_status: { license_status_id: 2 },
          documents: {},
          required_documents: [],
        },
      } as unknown as PlayerWithLicense;
      component.team = { id: 1, name: 'Musterstadt' } as never;
      fixture.detectChanges();
      return fixture.nativeElement;
    }

    // Gezielt über data-testid: Ein Strich steht auch bei den fehlenden
    // Dokumenten, ein Vergleich über den ganzen Seitentext wäre für den
    // zweiten Fall tautologisch.
    function genderText(root: HTMLElement): string {
      return (
        root.querySelector('[data-testid="player-gender"]')?.textContent ?? ''
      ).trim();
    }

    it('nennt das Geschlecht im Datenblock', () => {
      const root = render('W');

      expect(root.textContent).toContain('Geschlecht');
      expect(genderText(root)).toBe('weiblich');
    });

    // Ein Leerstring liesse die Zeile leer stehen und wäre von "steht nicht in
    // den Stammdaten" nicht zu unterscheiden.
    it('setzt einen Strich, wenn das Geschlecht nicht gepflegt ist', () => {
      const root = render(null);

      expect(root.textContent).toContain('Geschlecht');
      expect(genderText(root)).toBe('–');
    });
  });
});
