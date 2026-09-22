import { ComponentFixture, TestBed } from '@angular/core/testing';

import { By } from '@angular/platform-browser';

import { LicenseAdminDetailComponent } from './license-admin-detail.component';
import { LicenseAdminTeamEntryComponent } from '../license-admin-team-entry/license-admin-team-entry.component';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { FormsModule } from '@angular/forms';
import { getTranslocoTestingModule } from '@floorball/core';
import { UikitCommonModule } from '@floorball/uikit/common';
import { UikitPlayerModule } from '@floorball/uikit/player';
import {
  GenderKey,
  League,
  PlayerLicense,
  PlayerLicenseHistory,
  PlayerOtherLicense,
  PlayerWithLicense,
  TeamWithPlayers,
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

  describe('licenseStatusId', () => {
    function component(): LicenseAdminDetailComponent {
      return TestBed.createComponent(LicenseAdminDetailComponent)
        .componentInstance;
    }

    // Der Grund für das Feld: Eine Wettbewerbs- oder Ligasperre steht nicht in
    // der History. Aus ihr allein gelesen gälte die Lizenz als erteilt.
    it('nimmt den wirksamen Status der API, nicht den aus der History', () => {
      const license = {
        id: 'l1',
        team_id: 1,
        effective_status_id: 9,
        history: [{ license_status_id: 1, created_at: '2026-09-01T10:00:00Z' }],
      } as unknown as PlayerLicense;

      expect(component().licenseStatusId(license)).toBe(9);
    });

    // Ältere API, nicht auflösbare Mannschaft oder eine History ohne
    // Basis-Status: Dann liefert die API das Feld nicht.
    it('fällt ohne das Feld auf den jüngsten History-Eintrag zurück', () => {
      const license = {
        id: 'l1',
        team_id: 1,
        history: [
          { license_status_id: 9, created_at: '2026-09-20T10:00:00Z' },
          { license_status_id: 1, created_at: '2026-09-01T10:00:00Z' },
        ],
      } as unknown as PlayerLicense;

      expect(component().licenseStatusId(license)).toBe(9);
    });

    // Gegenrichtung, und ebenso real: Nach einer abgelaufenen Sperre bleibt
    // der `gesperrt`-Eintrag in der History stehen, die API rechnet die Lizenz
    // aber wieder als erteilt. Ohne diese Prüfung bliebe eine "Verbesserung"
    // unbemerkt, die das Feld nur bei einer Sperre gewinnen lässt.
    it('nimmt den wirksamen Status auch, wenn er milder ist als die History', () => {
      const license = {
        id: 'l1',
        team_id: 1,
        effective_status_id: 1,
        history: [{ license_status_id: 9, created_at: '2026-09-20T10:00:00Z' }],
      } as unknown as PlayerLicense;

      expect(component().licenseStatusId(license)).toBe(1);
    });

    it('gibt ohne History und ohne Feld nichts zurück', () => {
      const license = {
        id: 'l1',
        team_id: 1,
        history: [],
      } as unknown as PlayerLicense;

      expect(component().licenseStatusId(license)).toBeUndefined();
    });
  });

  describe('latestHistory', () => {
    function entry(statusId: number, createdAt?: string): PlayerLicenseHistory {
      return {
        license_status_id: statusId,
        created_at: createdAt,
        created_by: 1,
      } as unknown as PlayerLicenseHistory;
    }

    function component(): LicenseAdminDetailComponent {
      return TestBed.createComponent(LicenseAdminDetailComponent)
        .componentInstance;
    }

    function withHistory(history: PlayerLicenseHistory[]): PlayerLicense {
      return { id: 'l1', team_id: 1, history } as PlayerLicense;
    }

    // Der Kern: Die API hängt die History an vielen Stellen an und garantiert
    // keine Sortierung; sie liest den aktuellen Status deshalb über
    // `max_by { created_at }`. Die Vorlage nahm bis hierher das letzte
    // Array-Element -- eine gesperrte Lizenz zeigte dann `erteilt`.
    it('nimmt den jüngsten Eintrag, nicht den letzten im Array', () => {
      const suspended = entry(9, '2026-09-20T10:00:00Z');
      const approved = entry(1, '2026-09-01T10:00:00Z');

      const latest = component().latestHistory(
        withHistory([suspended, approved])
      );

      expect(latest?.license_status_id).toBe(9);
    });

    it('nimmt bei aufsteigender Reihenfolge weiterhin den letzten', () => {
      const approved = entry(1, '2026-09-01T10:00:00Z');
      const suspended = entry(9, '2026-09-20T10:00:00Z');

      const latest = component().latestHistory(
        withHistory([approved, suspended])
      );

      expect(latest?.license_status_id).toBe(9);
    });

    // Altbestand ohne Zeitstempel: Er darf einen datierten Eintrag nicht
    // verdrängen, egal an welcher Stelle er steht.
    it('lässt einen Eintrag ohne Zeitstempel gegen einen datierten verlieren', () => {
      const undated = entry(2);
      const approved = entry(1, '2026-09-01T10:00:00Z');

      expect(
        component().latestHistory(withHistory([approved, undated]))
          ?.license_status_id
      ).toBe(1);
      expect(
        component().latestHistory(withHistory([undated, approved]))
          ?.license_status_id
      ).toBe(1);
    });

    // Tragen alle Einträge keinen Zeitstempel, entscheidet die Reihenfolge --
    // und zwar wie in der API: `max_by` gibt bei Gleichstand den ersten
    // Treffer zurück.
    it('nimmt unter lauter undatierten Einträgen den ersten', () => {
      const latest = component().latestHistory(
        withHistory([entry(2), entry(1)])
      );

      expect(latest?.license_status_id).toBe(2);
    });

    // Gleichstand ist der Fall, in dem eine naheliegende Umstellung (etwa auf
    // `sort().reverse()[0]` oder auf `>=`) still etwas anderes liefert. Die
    // API ist hier eindeutig: `max_by` nimmt den ersten der Gleichstehenden.
    it('nimmt bei gleichen Zeitstempeln den ersten Eintrag', () => {
      const latest = component().latestHistory(
        withHistory([
          entry(9, '2026-09-20T10:00:00Z'),
          entry(1, '2026-09-20T10:00:00Z'),
        ])
      );

      expect(latest?.license_status_id).toBe(9);
    });

    // Mit zwei Einträgen ist "der jüngste" nicht von "einer der beiden" zu
    // unterscheiden. Produktionshistorien sind länger (beantragt, erteilt,
    // gesperrt, entsperrt), und der jüngste steht dort auch mal in der Mitte.
    it('findet den jüngsten Eintrag auch in der Mitte einer längeren History', () => {
      const latest = component().latestHistory(
        withHistory([
          entry(2, '2026-08-01T10:00:00Z'),
          entry(1, '2026-08-15T10:00:00Z'),
          entry(9, '2026-09-20T10:00:00Z'),
          entry(3, '2026-08-20T10:00:00Z'),
        ])
      );

      expect(latest?.license_status_id).toBe(9);
    });

    // Der Schutzzweig `license?.history ?? []`: Altbestände ohne History-Feld.
    it('kommt mit einer Lizenz ohne History-Feld zurecht', () => {
      const withoutHistory = { id: 'l1', team_id: 1 } as PlayerLicense;

      expect(component().latestHistory(withoutHistory)).toBeUndefined();
    });

    it('gibt ohne History nichts zurück', () => {
      expect(component().latestHistory(withHistory([]))).toBeUndefined();
    });
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
      const component = TestBed.createComponent(
        LicenseAdminDetailComponent
      ).componentInstance;
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
        withDocuments({
          id_copy: true,
          id_copy_uploaded_at: true,
        }).docUploadedAt('id_copy')
      ).toBeNull();
    });
  });

  // Das Geschlecht liegt im Payload (Player#full_hash) und stand in der
  // Antragsmaske trotzdem nicht. Ein Getter-Test würde das nicht bemerken:
  // Der Fehler sass seinerzeit in der BINDUNG, nicht in einer Methode: Die
  // Vorlage gab `license.history[license.history.length - 1]` an die Zeile
  // weiter. Eine Getter-Prüfung allein bemerkt es nicht, wenn jemand die
  // Bindung zurückdreht oder beim Umbau der Karte kopiert.
  describe('Statusquelle der Lizenzzeile', () => {
    // Zwei Lizenzen in einer Karte: die erste mit dem wirksamen Status der
    // API (der von ihrer History abweicht), die zweite ohne das Feld. Damit
    // deckt derselbe Durchgang beide Zweige der Bindung ab -- und ein
    // Zurückdrehen auf `latestHistory(...)` faellt an der ersten auf, was mit
    // einer Fixture ohne `effective_status_id` nicht der Fall waere.
    function render(): ComponentFixture<LicenseAdminDetailComponent> {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [
          HttpClientTestingModule,
          RouterTestingModule,
          UikitPlayerModule,
          UikitCommonModule,
          FormsModule,
          getTranslocoTestingModule(),
        ],
        declarations: [
          LicenseAdminDetailComponent,
          LicenseAdminTeamEntryComponent,
        ],
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
        clubs: [],
        // Ohne Liga filtert currentSeasonLicenses() nicht, beide Lizenzen
        // werden also gerendert.
        licenses: [
          {
            // Wettbewerbssperre: Die History weiss nichts davon, die API
            // schon. Genau dafür gibt es das Feld.
            id: 'l1',
            team_id: 1,
            effective_status_id: 9,
            history: [
              { license_status_id: 1, created_at: '2026-09-01T10:00:00Z' },
            ],
          },
          {
            // Ohne das Feld (ältere API, nicht auflösbare Mannschaft, keine
            // Basis): der jüngste Eintrag entscheidet, hier unsortiert.
            id: 'l2',
            team_id: 2,
            history: [
              { license_status_id: 9, created_at: '2026-09-20T10:00:00Z' },
              { license_status_id: 1, created_at: '2026-09-01T10:00:00Z' },
            ],
          },
        ],
        team_license: {
          license: { id: 'l1', team_id: 1, history: [] },
          last_status: { license_status_id: 2 },
          documents: {},
          required_documents: [],
        },
      } as unknown as PlayerWithLicense;
      component.team = {
        id: 1,
        name: 'Musterstadt',
      } as unknown as TeamWithPlayers;
      fixture.detectChanges();
      return fixture;
    }

    function rows(fixture: ComponentFixture<LicenseAdminDetailComponent>) {
      return fixture.debugElement.queryAll(
        By.directive(LicenseAdminTeamEntryComponent)
      );
    }

    it('zeigt die gesperrte Lizenz als gesperrt, obwohl ihre History erteilt sagt', () => {
      const fixture = render();
      const row = rows(fixture)[0];

      expect(row).withContext('die Lizenzzeile wird gerendert').not.toBeNull();
      expect(row.componentInstance.statusId).toBe(9);
      // Nicht nur die Eingabe, sondern das, was die SBK sieht.
      expect(
        (row.nativeElement as HTMLElement).querySelector('title')?.textContent
      ).toContain('teamEntry.status.suspended');
    });

    it('nimmt ohne das Feld den Status des jüngsten Eintrags', () => {
      const fixture = render();

      expect(rows(fixture)[1].componentInstance.statusId).toBe(9);
    });
  });

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
      component.team = {
        id: 1,
        name: 'Musterstadt',
      } as unknown as TeamWithPlayers;
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
  // Der Expresszuschlag stammt aus dem Antrag, nicht aus der Bearbeitung: Ein
  // wegen fehlender Unterlagen abgelehnter und spaeter nachgebesserter Antrag
  // wird ohne Eilbearbeitung erteilt und soll dann auch nicht als Expresslizenz
  // abgerechnet werden. Die Entscheidung faellt an diesen beiden Knoepfen.
  describe('Expresszuschlag bei der Genehmigung', () => {
    function render(express: boolean | undefined): {
      root: HTMLElement;
      http: HttpTestingController;
    } {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [
          HttpClientTestingModule,
          RouterTestingModule,
          UikitPlayerModule,
          UikitCommonModule,
          FormsModule,
          getTranslocoTestingModule({
            de: {
              licenseAdmin: {
                detail: {
                  grantLicense: 'Lizenz erteilen',
                  grantAsExpress: 'Als Expresslizenz erteilen',
                  grantAsStandard: 'Als normale Lizenz erteilen',
                },
              },
            },
          }),
        ],
        declarations: [LicenseAdminDetailComponent],
      });
      const fixture = TestBed.createComponent(LicenseAdminDetailComponent);
      const component = fixture.componentInstance;
      component.initiallyOpen = true;
      component.allClubs = [];
      component.player = {
        id: 7,
        first_name: 'Mia',
        last_name: 'Muster',
        birthdate: '2000-05-01',
        gender: 'W',
        clubs: [],
        licenses: [],
        team_license: {
          license: { id: 'l1', team_id: 1, history: [] },
          last_status: { license_status_id: 2 },
          documents: {},
          required_documents: [],
          ...(express === undefined ? {} : { express }),
        },
      } as unknown as PlayerWithLicense;
      component.team = {
        id: 1,
        name: 'Musterstadt',
      } as unknown as TeamWithPlayers;
      fixture.detectChanges();
      return {
        root: fixture.nativeElement,
        http: TestBed.inject(HttpTestingController),
      };
    }

    function click(root: HTMLElement, testid: string): void {
      const button = root.querySelector<HTMLButtonElement>(
        `[data-testid="${testid}"]`
      );
      expect(button).withContext(testid).not.toBeNull();
      button!.click();
    }

    function sentBody(http: HttpTestingController): Record<string, unknown> {
      const request = http.expectOne((r) =>
        r.url.endsWith('admin/players/7/handle_license_request.json')
      );
      return request.request.body as Record<string, unknown>;
    }

    it('bietet bei einem Expressantrag beide Wege an', () => {
      const { root } = render(true);

      expect(
        root.querySelector('[data-testid="grant-as-express"]')?.textContent
      ).toContain('Als Expresslizenz erteilen');
      expect(
        root.querySelector('[data-testid="grant-as-standard"]')?.textContent
      ).toContain('Als normale Lizenz erteilen');
      expect(root.querySelector('[data-testid="grant-license"]')).toBeNull();
    });

    // Ohne Expressantrag gibt es nichts zu entscheiden. Ein zweiter Knopf
    // legte nahe, dass sich eine gewoehnliche Lizenz hochstufen liesse -- die
    // API weist genau das ab.
    it('laesst den gewoehnlichen Antrag bei einem Knopf', () => {
      const { root } = render(undefined);

      expect(
        root.querySelector('[data-testid="grant-license"]')?.textContent
      ).toContain('Lizenz erteilen');
      expect(root.querySelector('[data-testid="grant-as-express"]')).toBeNull();
      expect(
        root.querySelector('[data-testid="grant-as-standard"]')
      ).toBeNull();
    });

    it('streicht den Zuschlag ueber den zweiten Knopf', () => {
      const { root, http } = render(true);

      click(root, 'grant-as-standard');

      const body = sentBody(http);
      expect(body['express']).toBe(false);
      expect(body['license_status_id']).toBe(1);
      http.verify();
    });

    it('laesst den Zuschlag ueber den ersten Knopf stehen', () => {
      const { root, http } = render(true);

      click(root, 'grant-as-express');

      expect(sentBody(http)['express']).toBe(true);
      http.verify();
    });

    // Ohne das Feld laesst die API den Zuschlag unangetastet. Ein mitgesendetes
    // `false` waere hier kein Unterschied, ein `true` dagegen eine Absage.
    it('schickt ohne Expressantrag gar kein Merkmal mit', () => {
      const { root, http } = render(undefined);

      click(root, 'grant-license');

      expect(Object.keys(sentBody(http))).not.toContain('express');
      http.verify();
    });
  });
});
