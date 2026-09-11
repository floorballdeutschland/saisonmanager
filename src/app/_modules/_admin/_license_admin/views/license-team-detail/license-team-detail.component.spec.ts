import { TestBed } from '@angular/core/testing';

import { LicenseTeamDetailComponent } from './license-team-detail.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { FormsModule } from '@angular/forms';
import { getTranslocoTestingModule } from '@floorball/core';
import { UikitCommonModule } from '@floorball/uikit/common';
import {
  LicenseDocument,
  LicenseHash,
  PlayerWithLicense,
} from '@floorball/types';
import { AssociationService } from '@floorball/core';
import { NEVER, Observable, of } from 'rxjs';

describe('LicenseTeamDetailComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [LicenseTeamDetailComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(LicenseTeamDetailComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  // Ob ein `per_season`-Dokument vorliegt, entscheidet die LAUFENDE Saison:
  // Der Upload von dieser Maske aus wird mit ihr gestempelt
  // (Admin::LicenseDocumentsController#create). Hinge die Prüfung stattdessen
  // am Saison-Umschalter der Seitenleiste, zählte nach einem Blick ins Archiv
  // einer Vorsaison deren Zustimmung als vorliegend -- der Verein lüde nichts
  // nach, und die API lehnte den Antrag später ab.
  describe('getDoc', () => {
    const dokumente = [
      { id: 1, document_type: 'parental_consent', season_id: 17 },
      { id: 2, document_type: 'parental_consent', season_id: 18 },
      { id: 3, document_type: 'passport', season_id: 16 },
    ] as LicenseDocument[];

    /**
     * Eigenes TestBed: Die Saison kommt über den Verbandsdienst in ngOnInit und
     * wird bewusst nicht am Feld gesetzt -- geprüft ist sonst die Rechenregel
     * und nicht die Verdrahtung, und nur die war der Fehler.
     */
    function build(
      laufend: Observable<number | null>
    ): LicenseTeamDetailComponent {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [
          HttpClientTestingModule,
          RouterTestingModule,
          getTranslocoTestingModule(),
        ],
        declarations: [LicenseTeamDetailComponent],
        providers: [
          {
            // Der Umschalter steht auf einer Vorsaison, die laufende ist 18.
            provide: AssociationService,
            useValue: {
              selectedSeasonId$: of(17),
              realCurrentSeasonId$: laufend,
            },
          },
        ],
      });

      const component = TestBed.createComponent(
        LicenseTeamDetailComponent
      ).componentInstance;
      component.licenseHash = {
        document_types: [
          { key: 'parental_consent', validity: 'per_season' },
          { key: 'passport', validity: 'once' },
        ],
      } as unknown as LicenseHash;
      component.documents = { 7: dokumente };
      component.ngOnInit();

      return component;
    }

    it('nimmt das Dokument der laufenden Saison, nicht der gewählten', () => {
      const component = build(of(18));

      expect(component.getDoc(7, 'parental_consent')?.id).toBe(2);
    });

    // `once` gilt saisonübergreifend -- der Saisonfilter darf hier gar nicht
    // erst greifen, sonst forderte die Maske einen Spielerpass jede Saison neu.
    it('lässt eine Dokumentart ohne Saisonbindung unberührt', () => {
      const component = build(of(18));

      expect(component.getDoc(7, 'passport')?.id).toBe(3);
    });

    // Solange `init` nicht geantwortet hat, steht die laufende Saison nicht
    // fest. Ohne den Riegel in #getDoc fiele die Prüfung auf den Zweig ohne
    // Saison zurück und meldete die Zustimmung der VORsaison als vorliegend --
    // und beantwortet `init` gar nicht, bliebe es dabei.
    it('meldet bei unbekannter Saison kein per_season-Dokument als vorliegend', () => {
      const component = build(NEVER);

      expect(component.currentSeasonId).toBeNull();
      expect(component.getDoc(7, 'parental_consent')).toBeUndefined();
      expect(component.getDoc(7, 'passport')?.id).toBe(3);
    });
  });

  // Der Upload der Elternzustimmung wurde vorher bei jeder minderjährigen
  // Person eingefordert, auch in Ligen, die sie gar nicht verlangen.
  describe('needsConsentFor', () => {
    function setup(
      requiredDocuments: string[] | undefined,
      flag = false
    ): {
      component: LicenseTeamDetailComponent;
      player: PlayerWithLicense;
    } {
      const fixture = TestBed.createComponent(LicenseTeamDetailComponent);
      const component = fixture.componentInstance;
      component.licenseHash = {
        parental_consent_required: flag,
      } as LicenseHash;
      const player = {
        id: 1,
        birthdate: '2012-05-04',
        required_documents: requiredDocuments,
      } as unknown as PlayerWithLicense;
      return { component, player };
    }

    it('fordert die Zustimmung, wenn die Liga sie verlangt', () => {
      const { component, player } = setup(['parental_consent'], true);

      expect(component.needsConsentFor(player)).toBe(true);
    });

    it('fordert sie nicht ohne Liga-Pflicht, auch bei Minderjährigen', () => {
      const { component, player } = setup([]);

      expect(component.needsConsentFor(player)).toBe(false);
    });

    it('greift ohne aufgelöste Liste auf das Liga-Flag zurück', () => {
      const withFlag = setup(undefined, true);
      expect(withFlag.component.needsConsentFor(withFlag.player)).toBe(true);

      const withoutFlag = setup(undefined);
      expect(withoutFlag.component.needsConsentFor(withoutFlag.player)).toBe(
        false
      );
    });
  });

  // Der Datenschutz-Hinweis nennt die Liga, die die Zustimmung verlangt. Ohne
  // sie las sich der Block wie eine Aussage über die 1. und 2. Bundesliga,
  // obwohl ihn auf Produktion auch Regionalligen auslösen.
  describe('parentalConsentLeagueName', () => {
    function componentWith(hash: Partial<LicenseHash>) {
      const fixture = TestBed.createComponent(LicenseTeamDetailComponent);
      fixture.componentInstance.licenseHash = hash as LicenseHash;
      return fixture.componentInstance;
    }

    it('gibt den Namen der auslösenden Liga zurück', () => {
      const component = componentWith({
        parental_consent_required: true,
        parental_consent_league: { id: 7, name: 'Regionalliga Bayern' },
      });

      expect(component.parentalConsentLeagueName).toBe('Regionalliga Bayern');
    });

    it('gibt null zurück, solange die API die Liga nicht mitliefert', () => {
      const component = componentWith({ parental_consent_required: true });

      expect(component.parentalConsentLeagueName).toBeNull();
    });
  });

  // Der Express-Hinweis nennt die Liga, wegen der die Expresslizenz möglich ist.
  // Das kann eine Pokal-Liga sein, deren Verband der Verein im Formular sonst
  // nirgends sieht (api#455).
  describe('expressLicenseLeagueName', () => {
    function componentWith(hash: Partial<LicenseHash>) {
      const fixture = TestBed.createComponent(LicenseTeamDetailComponent);
      fixture.componentInstance.licenseHash = hash as LicenseHash;
      return fixture.componentInstance;
    }

    it('gibt den Namen der erlaubenden Liga zurück', () => {
      const component = componentWith({
        express_license_enabled: true,
        express_license_league: { id: 12, name: 'FD-Pokal' },
      });

      expect(component.expressLicenseLeagueName).toBe('FD-Pokal');
    });

    it('gibt null zurück, solange die API die Liga nicht mitliefert', () => {
      const component = componentWith({ express_license_enabled: true });

      expect(component.expressLicenseLeagueName).toBeNull();
    });
  });

  // Der Getter allein sagt nichts über das, was der Verein liest. Bricht die
  // Verdrahtung Template ↔ i18n-Schlüssel ↔ Platzhalter, verschwindet der
  // Liganame lautlos: Bei einem Platzhalter, der nicht `league` heißt, rendert
  // der Satz als "Möglich ist sie wegen der Liga ." und in Produktion protokolliert
  // Transloco das nicht einmal (`logMissingKey: false`). Genau die Angabe, um die
  // es in diesem Fix geht, wäre dann weg, und die Getter-Specs bleiben grün.
  //
  // Die Übersetzung wird global gestellt (`de: { licenseAdmin: … }`), nicht als
  // Scope-Schlüssel `'admin/license/de'`: Letzteres bleibt in diesem TestBed
  // unaufgelöst, weil die Komponente hier ohne ihr Modul und damit ohne dessen
  // TRANSLOCO_SCOPE steht.
  describe('Express-Hinweis im Formular', () => {
    function render(hash: Partial<LicenseHash>): string {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [
          HttpClientTestingModule,
          RouterTestingModule,
          // Das Template braucht die Pipes aus dem UIKit (sortPlayers und
          // Nachbarn) und ngModel fuer die Formularfelder. Die Getter-Specs oben
          // rendern nicht und kommen ohne beides aus.
          UikitCommonModule,
          FormsModule,
          getTranslocoTestingModule({
            de: {
              licenseAdmin: {
                teamDetail: {
                  expressLeagueHint: 'Zuständig ist {{league}}.',
                },
              },
            },
          }),
        ],
        declarations: [LicenseTeamDetailComponent],
      });
      const fixture = TestBed.createComponent(LicenseTeamDetailComponent);
      // ngOnInit lädt nichts: ohne teamId-Param im Router bleibt
      // loadUserLicenses() aus, der Hash kommt hier direkt aus dem Test.
      fixture.componentInstance.licenseHash = {
        team: { id: 1, name: 'Musterstadt' },
        current_requests: [],
        other_players: [],
        ...hash,
      } as unknown as LicenseHash;
      fixture.detectChanges();
      return fixture.nativeElement.textContent ?? '';
    }

    it('nennt die Liga im Hinweis, mit aufgeloestem Platzhalter', () => {
      const text = render({
        express_license_enabled: true,
        express_license_league: { id: 12, name: 'FD-Pokal' },
      });

      expect(text).toContain('Zuständig ist FD-Pokal.');
      // Ein vertippter Schlüsselpfad rendert den rohen Punktpfad in die Seite.
      // Nur auf diesen einen Schlüssel prüfen: Der Test stellt bewusst nur ihn
      // bereit, alle übrigen Schlüssel der Seite stehen hier erwartungsgemäß roh.
      expect(text).not.toContain('expressLeagueHint');
    });

    // Der Hinweis hängt am Express-Häkchen, nicht am Liga-Feld. Stellt jemand das
    // äußere @if später auf expressLicenseLeagueName um, stünde die Ligazeile im
    // Formular, ohne dass die Expresslizenz überhaupt angeboten wird.
    it('zeigt den Hinweis nicht, wenn keine Liga die Expresslizenz erlaubt', () => {
      const text = render({
        express_license_enabled: false,
        express_license_league: { id: 12, name: 'FD-Pokal' },
      });

      expect(text).not.toContain('FD-Pokal');
    });
  });

  // Eine Sperre auf einen Wettbewerb oder eine Liga fasst den Lizenzstatus
  // nicht an (api#605). Die Zeile stand hier deshalb weiter auf „erteilt", und
  // der Verein sah von der Sperre nichts.
  describe('Sperre in der Antragsliste', () => {
    function render(player: Partial<PlayerWithLicense>) {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [
          HttpClientTestingModule,
          RouterTestingModule,
          UikitCommonModule,
          FormsModule,
          getTranslocoTestingModule({
            de: {
              licenseAdmin: {
                teamDetail: {
                  suspendedLabel: 'Gesperrt:',
                  gamesRemaining:
                    'noch {{ remaining }} von {{ total }} Spielen',
                  suspendedUntil: 'bis',
                },
              },
            },
          }),
        ],
        declarations: [LicenseTeamDetailComponent],
      });
      const fixture = TestBed.createComponent(LicenseTeamDetailComponent);
      fixture.componentInstance.licenseHash = {
        team: { id: 1, name: 'Musterstadt' },
        current_requests: [
          {
            id: 7,
            last_name: 'Meier',
            first_name: 'Anna',
            birthdate: '1990-01-01',
            team_license: { id: 'abc', license: {} },
            current_status: { license_status_id: 1, license_status: 'erteilt' },
            ...player,
          },
        ],
        other_players: [],
      } as unknown as LicenseHash;
      fixture.detectChanges();
      return fixture;
    }

    const sperre = {
      scope_summary: 'Herren Großfeld, Ligaspielbetrieb',
      games_total: 3,
      remaining_games: 2,
      valid_until: '2026-10-31',
    };

    it('nennt Geltungsbereich und Dauer, obwohl der Status erteilt bleibt', () => {
      const text = render({ suspension: sperre }).nativeElement.textContent;

      expect(text).toContain('Gesperrt:');
      expect(text).toContain('Herren Großfeld, Ligaspielbetrieb');
      expect(text).toContain('noch 2 von 3 Spielen');
      expect(text).toContain('31.10.2026');
    });

    it('nennt bei einer Sperre über Spiele kein Datum', () => {
      const text = render({
        suspension: {
          scope_summary: 'Herren Großfeld, Ligaspielbetrieb',
          games_total: 3,
          remaining_games: 2,
          valid_until: null,
        },
      } as unknown as Partial<PlayerWithLicense>).nativeElement.textContent;

      expect(text).toContain('noch 2 von 3 Spielen');
      expect(text).not.toContain('bis');
    });

    it('nennt bei einer Sperre bis zu einem Datum keine Spiele', () => {
      const text = render({
        suspension: {
          scope_summary: 'Herren Großfeld, Ligaspielbetrieb',
          games_total: null,
          remaining_games: null,
          valid_until: '2026-10-31',
        },
      } as unknown as Partial<PlayerWithLicense>).nativeElement.textContent;

      expect(text).toContain('31.10.2026');
      expect(text).not.toContain('Spielen');
    });

    // Diese Ansicht liest der Verein. Der Grund einer Sperre gehört dem
    // Verband -- die API schickt ihn hier gar nicht mit, und die Ansicht darf
    // ihn auch dann nicht zeigen, wenn er doch im Payload landet.
    it('zeigt die Begründung der Sperre nicht', () => {
      const text = render({
        suspension: { ...sperre, reason: 'Unsportliches Verhalten' },
      } as unknown as Partial<PlayerWithLicense>).nativeElement.textContent;

      expect(text).toContain('Gesperrt:');
      expect(text).not.toContain('Unsportliches');
    });

    it('zeigt ohne Sperre keinen Hinweis', () => {
      const text = render({ suspension: null }).nativeElement.textContent;

      expect(text).toContain('Meier');
      expect(text).not.toContain('Gesperrt:');
    });

    // Eine mannschaftsweite Sperre schreibt den Status 9 in die Historie. Der
    // fiel hier in die graue Sammelfarbe und war von „zurückgezogen" nicht zu
    // unterscheiden.
    it('färbt den Status gesperrt rot', () => {
      const fixture = render({
        current_status: { license_status_id: 9, license_status: 'gesperrt' },
        suspension: sperre,
      } as unknown as Partial<PlayerWithLicense>);
      const badge = Array.from(
        fixture.nativeElement.querySelectorAll('p')
      ).find((el) => (el as HTMLElement).textContent?.trim() === 'gesperrt');

      expect((badge as HTMLElement).className).toContain('bg-red-100');
    });
  });
});
