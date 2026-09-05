import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ErrorHandler } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';

import { PlayerEditComponent } from './player-edit.component';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { environment } from 'src/environments/environment';
import { HttpErrorResponse } from '@angular/common/http';
import {
  getTranslocoTestingModule,
  NotificationService,
  PlayerService,
  SessionService,
} from '@floorball/core';
import { RouterTestingModule } from '@angular/router/testing';
import { FormsModule } from '@angular/forms';
import { UikitCommonModule } from '@floorball/uikit/common';
import { UikitMatchesModule } from '@floorball/uikit/matches';
import { UikitPlayerModule } from '@floorball/uikit/player';
import { UikitTeamModule } from '@floorball/uikit/team';
import {
  Club,
  LicenseDocument,
  Player,
  PlayerLicense,
  Season,
  User,
} from '@floorball/models';

describe('PlayerEditComponent', () => {
  let currentUser$: BehaviorSubject<User | null>;

  beforeEach(async () => {
    currentUser$ = new BehaviorSubject<User | null>(null);
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        // Die Anlege-Maske rendert die Eingabefelder mit ngModel; ohne
        // FormsModule protokolliert Angular dafür eine unbekannte Bindung.
        FormsModule,
        getTranslocoTestingModule(),
        UikitCommonModule,
        UikitPlayerModule,
        UikitTeamModule,
        UikitMatchesModule,
      ],
      declarations: [PlayerEditComponent],
      // Mit playerId in der Route bleibt editMode true, sonst schaltet ngOnInit
      // beim ersten detectChanges auf die Neuanlage um.
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { params: of({ playerId: '7' }) },
        },
        { provide: SessionService, useValue: { currentUser$ } },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(PlayerEditComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  // fe#318: Die Karte „Zusatzverein hinzufügen" weist einen Verein zu, die
  // Liste `allClubs` benennt daneben aber auch die bestehenden Zugehörigkeiten.
  // Eingegrenzt wird deshalb nur die Auswahl.
  describe('assignableClubs', () => {
    function build(clubs: Club[]): PlayerEditComponent {
      const component =
        TestBed.createComponent(PlayerEditComponent).componentInstance;
      component.player = { clubs: [] } as unknown as Player;
      component.allClubs = clubs;
      component['_refreshAssignableClubs']();
      return component;
    }

    it('bietet keine deaktivierten Vereine zur Auswahl an', () => {
      const component = build([
        { id: 1, name: 'Aktiv' } as Club,
        { id: 2, name: 'Deaktiviert', deactivated: true } as Club,
      ]);

      expect(component.assignableClubs.map((c) => c.id)).toEqual([1]);
    });

    it('behält den deaktivierten Verein zum Nachschlagen in allClubs', () => {
      const component = build([
        { id: 2, name: 'Deaktiviert', deactivated: true } as Club,
      ]);

      expect(component.getClubNameById(2)).toBe('Deaktiviert');
    });

    // „Erneut freigeben" weist denselben Verein erneut zu, geht dafür aber
    // nicht über `assignableClubs`. Ohne eigene Prüfung bliebe dieser Weg offen.
    it('erkennt den deaktivierten Verein für „Erneut freigeben"', () => {
      const component = build([
        { id: 1, name: 'Aktiv' } as Club,
        { id: 2, name: 'Deaktiviert', deactivated: true } as Club,
      ]);

      expect(component.isClubDeactivated(2)).toBe(true);
      expect(component.isClubDeactivated(1)).toBe(false);
      expect(component.isClubDeactivated(99)).toBe(false);
    });
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

  // Der Verweis auf die Transferanträge ersetzt einen direkten Wechsel am
  // Profil und darf nur bei den Rollen auftauchen, die dort auch die
  // Direktzuweisung auslösen dürfen.
  // Der Lizenzverlauf rendert Zeitstempel aus einem JSONB-Feld, in dem auch
  // Bestand liegt, den die DatePipe nicht lesen kann. Sie würde dafür NG02100
  // werfen und aus einer Pipe heraus die Change Detection beenden, also die
  // ganze Maske mitnehmen (Sentry SAISONMANAGER-3B).
  //
  // Der Test rendert bewusst über das echte UikitCommonModule statt die Pipe
  // direkt zu bauen: Nur so hängt er an der Registrierung UND am
  // DatePipe-Provider, den SafeDatePipe injiziert. Ohne ihn stirbt die Maske in
  // Produktion mit NullInjectorError, während ein Pipe-Unittest grün bliebe.
  describe('Lizenzverlauf mit unlesbarem Zeitstempel', () => {
    function renderMitVerlauf(
      createdAt: string
    ): ComponentFixture<PlayerEditComponent> {
      currentUser$.next({ permissions: {} } as unknown as User);
      const fixture = TestBed.createComponent(PlayerEditComponent);
      fixture.componentInstance.seasons = [
        { id: 18, name: '2026/2027', current: true },
      ] as Season[];
      fixture.componentInstance.currentSeasonId = 18;
      fixture.componentInstance.player = {
        id: 7,
        licenses: [
          {
            id: 'a',
            team_id: 1,
            season_id: 18,
            league_class_id: '',
            requested_at: '',
            history: [
              {
                created_at: createdAt,
                license_status: 'beantragt',
                created_by_name: 'Testkonto',
              },
            ],
          } as unknown as PlayerLicense,
        ],
      } as Player;
      fixture.detectChanges(false);
      return fixture;
    }

    it('rendert die Maske, statt an der DatePipe zu scheitern', () => {
      const fixture = renderMitVerlauf('unbekannt');

      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('unbekannt');
      expect(text).toContain('beantragt');
    });

    it('formatiert einen lesbaren Zeitstempel weiterhin', () => {
      const fixture = renderMitVerlauf('2026-08-24T19:16:15Z');

      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('24.08.2026');
    });
  });

  // 292 Profile aus dem Altdaten-Import tragen kein Geburtsdatum, 161 davon sind
  // aktiv und rund 40 hängen an echten Vereinen, sind für den Vereinsmanager also
  // über die Spielerliste erreichbar. `errorMsg` griff mit `player.birthdate.length`
  // ungeschützt darauf zu, und weil das Template `error(player)` in der Change
  // Detection auswertet, zerlegte der TypeError die ganze Maske statt nur die
  // Meldung. Gemeldet über Spieler 13271 (Sentry SAISONMANAGER-41).
  describe('Profil ohne Geburtsdatum', () => {
    function renderMitGeburtsdatum(
      birthdate: string | null
    ): ComponentFixture<PlayerEditComponent> {
      // `update_player` ist nötig, damit das Template den Block mit
      // `@if (error(player))` überhaupt rendert, und genau dort schlug der
      // TypeError zu. Mit leeren permissions bleibt die Maske lesend und der
      // Test wäre eine Scheinabsicherung.
      currentUser$.next({
        permissions: { update_player: true },
      } as unknown as User);
      const fixture = TestBed.createComponent(PlayerEditComponent);
      fixture.componentInstance.player = {
        id: 13271,
        first_name: 'Alexandra',
        last_name: 'Zadilska',
        birthdate,
        nation_id: 99,
        licenses: [],
      } as unknown as Player;
      fixture.detectChanges(false);
      return fixture;
    }

    it('rendert die Maske, statt am fehlenden Geburtsdatum zu scheitern', () => {
      const fixture = renderMitGeburtsdatum(null);

      // Der Name steckt im value der Eingabefelder, nicht im Textinhalt; die
      // Spieler-ID und die Beanstandung beweisen, dass die Maske samt dem
      // Block mit `error(player)` durchgelaufen ist.
      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('13271');
      expect(text).toContain('playerAdmin.notifications.errBirthdate');
    });

    it('meldet das fehlende Geburtsdatum als Grund', () => {
      const komponente = renderMitGeburtsdatum(null).componentInstance;
      const spieler = komponente.player as Player;

      expect(komponente.error(spieler)).toBeTrue();
      // Ohne hinterlegte Scope-Übersetzungen gibt Transloco im Test den
      // Schlüssel zurück; geprüft wird hier die Verzweigung, nicht der Text.
      expect(komponente.errorMsg(spieler)).toEqual([
        'playerAdmin.notifications.errBirthdate',
      ]);
    });

    it('beanstandet ein vorhandenes Geburtsdatum nicht', () => {
      const komponente = renderMitGeburtsdatum('2000-09-25').componentInstance;
      const spieler = komponente.player as Player;

      expect(komponente.error(spieler)).toBeFalse();
      expect(komponente.errorMsg(spieler)).toEqual([]);
    });

    it('beanstandet auch leere Namen und fehlende Nationalität', () => {
      const komponente = renderMitGeburtsdatum(null).componentInstance;
      const spieler = {
        id: 0,
        first_name: '',
        last_name: null,
        birthdate: null,
        nation_id: null,
        licenses: [],
      } as unknown as Player;

      expect(komponente.errorMsg(spieler)).toEqual([
        'playerAdmin.notifications.errFirstName',
        'playerAdmin.notifications.errLastName',
        'playerAdmin.notifications.errBirthdate',
        'playerAdmin.notifications.errNationality',
      ]);
    });
  });

  // Zuständig für die Erst-/Zweitlizenz-Zuordnung ist der Verband der Liga, an
  // der die Lizenz hängt. Das Profil zeigt alle Lizenzen der Person, auch die
  // aus fremden Spielbetrieben, und `player_set_gf_role` allein unterscheidet
  // sie nicht: Der permissions-Hash kennt keine Spielbetriebe. Die Knöpfe
  // standen daher an jeder GF-Erwachsenenlizenz, und auf einer fremden wies die
  // API mit 403 ab. api#555 liefert die Zuständigkeit je Lizenz mit.
  describe('Erst-/Zweitlizenz-Zuordnung', () => {
    function gfLicense(
      id: string,
      gfRoleEditable?: boolean,
      gfRole?: 'erstlizenz' | 'zweitlizenz'
    ): PlayerLicense {
      return {
        id,
        team_id: 1,
        season_id: 18,
        league_class_id: '',
        requested_at: '',
        history: [{ license_status_id: 2 }],
        league: { field_size: 'GF', age_group: 'Herren', female: false },
        gf_role: gfRole,
        gf_role_editable: gfRoleEditable,
      } as unknown as PlayerLicense;
    }

    function build(licenses: PlayerLicense[]): PlayerEditComponent {
      currentUser$.next({
        permissions: { player_set_gf_role: true },
      } as unknown as User);
      const fixture = TestBed.createComponent(PlayerEditComponent);
      fixture.componentInstance.player = { id: 7, licenses } as Player;
      fixture.detectChanges(false);
      return fixture.componentInstance;
    }

    it('bietet die Zuordnung im eigenen Spielbetrieb an', () => {
      const own = gfLicense('eigen', true);
      const component = build([own, gfLicense('partner', true)]);

      expect(component.gfRoleEditable(own)).toBe(true);
    });

    it('bietet sie für eine Lizenz eines fremden Spielbetriebs nicht an', () => {
      // Zuordnung gesetzt und Partnerlizenz vorhanden: Ohne die Auskunft der API
      // wären damit beide übrigen Bedingungen erfüllt und die Knöpfe da.
      const foreign = gfLicense('fremd', false, 'erstlizenz');
      const component = build([foreign, gfLicense('partner', true)]);

      expect(component.gfRoleEditable(foreign)).toBe(false);
    });

    // Abwärtskompatibilität: Eine API vor api#555 liefert das Feld nicht. Würde
    // ein fehlender Wert sperren, wäre die Zuordnung im ganzen Bestand weg.
    it('bleibt beim alten Verhalten, wenn die API das Feld nicht liefert', () => {
      const legacy = gfLicense('ohne-feld', undefined, 'erstlizenz');
      const component = build([legacy]);

      expect(component.gfRoleEditable(legacy)).toBe(true);
    });
  });

  describe('Verweis auf die Transferanträge', () => {
    // Die Berechtigung muss vor dem ersten Rendern stehen: die Komponente liest
    // sie in ngOnInit aus currentUser$, ein spaeteres Setzen des Feldes laeuft
    // nicht mehr in die Bindings (Angular 22, dirty-getrackte Views).
    function render(
      permissions: Record<string, boolean>
    ): ComponentFixture<PlayerEditComponent> {
      currentUser$.next({ permissions } as unknown as User);
      const fixture = TestBed.createComponent(PlayerEditComponent);
      fixture.componentInstance.player = { id: 7 } as Player;
      // Ohne checkNoChanges: die Saison-Abos liefern ihren Wert erst im selben
      // Durchlauf nach, das ist hier nicht der Prüflingsteil.
      fixture.detectChanges(false);
      return fixture;
    }

    function link(
      fixture: ComponentFixture<PlayerEditComponent>
    ): Element | null {
      return fixture.nativeElement.querySelector(
        'a[href="/verwaltung/transfer-anfragen"]'
      );
    }

    it('links to the transfer requests for SBK and admin', () => {
      expect(link(render({ menu_item_transfer_requests_sbk: true }))).not.toBe(
        null
      );
    });

    it('hides the link for club and team managers', () => {
      expect(link(render({ menu_item_player_admin: true }))).toBe(null);
    });
  });

  // Anlegen darf nur der Vereinsmanager des Vereins, Admin und SBK überall
  // (api: Club#user_permissions, :create_player). Ein Teammanager erreicht die
  // Maske über die Route, bekommt aber keine Eingabefelder, sondern den Grund.
  describe('Neuanlage', () => {
    function render(
      user: Partial<User>,
      params: Record<string, string> = { clubId: '113' }
    ): ComponentFixture<PlayerEditComponent> {
      TestBed.overrideProvider(ActivatedRoute, {
        useValue: { params: of(params) },
      });
      currentUser$.next(user as User);
      const fixture = TestBed.createComponent(PlayerEditComponent);
      fixture.detectChanges(false);
      return fixture;
    }

    function hint(
      fixture: ComponentFixture<PlayerEditComponent>
    ): Element | null {
      return fixture.nativeElement.querySelector(
        '[data-testid="create-not-allowed"]'
      );
    }

    it('lässt den Vereinsmanager des Vereins anlegen', () => {
      const fixture = render({
        club_ids: [113],
        permissions: { create_player: true },
      } as Partial<User>);

      expect(fixture.componentInstance.createNotAllowed).toBe(false);
      expect(fixture.componentInstance.can('player_create_update')).toBe(true);
      expect(hint(fixture)).toBe(null);
    });

    // Ein reiner Teammanager hat kein club_ids: permission_hash[:vm] ist leer,
    // `club_ids` kommt als null. Die übrigen Rechte sind die echten, denn genau
    // an ihnen hing der Fehler: `update_player_email` gilt auch für den TM, und
    // solange `create_player` in der Anlage true war, blieb der zweite
    // E-Mail-Zweig der Maske unerreichbar.
    it('nennt dem Teammanager den Grund statt eines Formulars', () => {
      const fixture = render({
        permissions: {
          create_player: true,
          update_player_email: true,
          player_deactivate: false,
        },
      } as Partial<User>);

      expect(fixture.componentInstance.createNotAllowed).toBe(true);
      expect(fixture.componentInstance.can('player_create_update')).toBe(false);
      expect(hint(fixture)).not.toBe(null);
    });

    // Regression: Mit `can('player_create_update') === false` erschien in der
    // Anlage der eigene Knopf „E-Mail speichern" samt Eingabefeld. Er kann
    // nicht tragen -- `saveEmail()` braucht eine Spieler-id, die es erst nach
    // dem Speichern gibt -- und kehrte ohne Meldung zurück.
    it('bietet dem Teammanager in der Anlage kein E-Mail-Feld an', () => {
      const fixture = render({
        permissions: { create_player: true, update_player_email: true },
      } as Partial<User>);

      expect(fixture.componentInstance.canEnterEmail).toBe(false);
      expect(fixture.componentInstance.canSaveEmailOnly).toBe(false);
      expect(fixture.nativeElement.querySelector('input#email')).toBe(null);
    });

    // Gegenprobe: Am bestehenden Profil bleibt genau dieser Weg dem
    // Vereins-/Teammanager erhalten (update_player_email).
    it('behaelt das E-Mail-Feld im Bearbeiten-Modus', () => {
      const fixture = render(
        { permissions: { update_player_email: true } } as Partial<User>,
        { clubId: '113', playerId: '7' }
      );
      fixture.componentInstance.player = { id: 7 } as Player;
      fixture.detectChanges(false);

      expect(fixture.componentInstance.canEnterEmail).toBe(true);
      expect(fixture.componentInstance.canSaveEmailOnly).toBe(true);
    });

    it('lässt den Teammanager auch in einem fremden Verein nicht anlegen', () => {
      const fixture = render({
        club_ids: [114],
        permissions: { create_player: true },
      } as Partial<User>);

      expect(fixture.componentInstance.createNotAllowed).toBe(true);
    });

    // Admin und SBK haben kein club_ids, das führt nur VM-Vereine. `update_player`
    // ist dabei eine unscoped Näherung für „Verbandsrolle": Eine Landes-SBK
    // bekommt hier auch für einen Verein eines fremden Spielbetriebs ein
    // Formular, dessen Speichern die API ablehnt. Für einen einzelnen fremden
    // Verein hat diese Maske keine bessere Quelle; die Vereinssicht hat eine.
    it('lässt Admin und SBK das Formular ausfüllen', () => {
      const fixture = render({
        permissions: { create_player: true, update_player: true },
      } as Partial<User>);

      expect(fixture.componentInstance.createNotAllowed).toBe(false);
      expect(hint(fixture)).toBe(null);
    });

    // Die Grenze gilt nur der Anlage: Ein bestehendes Profil öffnet der
    // Teammanager weiter, das Speichern hängt dort an :update_player.
    it('greift im Bearbeiten-Modus nicht', () => {
      const fixture = render({ permissions: {} } as Partial<User>, {
        clubId: '113',
        playerId: '7',
      });

      expect(fixture.componentInstance.createNotAllowed).toBe(false);
      expect(hint(fixture)).toBe(null);
    });

    // Der Verein kann das Anlegen seinen Teammanager*innen freigeben. Die
    // Rollenliste im Browser sieht davon nichts: `club_ids` führt nur
    // VM-Vereine. Maßgeblich ist `manage_players` aus vm/clubs_and_teams,
    // also dieselbe Quelle wie die Prüfung beim Schreiben.
    function freigeben(clubs: { id: number; manage_players: boolean }[]): void {
      const httpMock = TestBed.inject(HttpTestingController);
      httpMock
        .expectOne(`${environment.apiURL}vm/clubs_and_teams.json`)
        .flush(clubs.map((club) => ({ ...club, teams: [] })));
    }

    it('laesst den Teammanager im freigegebenen Verein anlegen', () => {
      const fixture = render({
        permissions: { create_player: true, update_player_email: true },
      } as Partial<User>);
      freigeben([{ id: 113, manage_players: true }]);
      fixture.detectChanges(false);

      expect(fixture.componentInstance.createNotAllowed).toBe(false);
      expect(fixture.componentInstance.can('player_create_update')).toBe(true);
      expect(hint(fixture)).toBe(null);
    });

    // Gegenprobe: Der Verein steht in der Liste, hat aber nicht freigegeben.
    // Der Teammanager sieht dort weiter nur den Grund.
    it('laesst ihn im nicht freigegebenen Verein weiter nicht anlegen', () => {
      const fixture = render({
        permissions: { create_player: true },
      } as Partial<User>);
      freigeben([{ id: 113, manage_players: false }]);
      fixture.detectChanges(false);

      expect(fixture.componentInstance.createNotAllowed).toBe(true);
      expect(hint(fixture)).not.toBe(null);
    });

    // Die Freigabe hängt am Verein: Wer Mannschaften zweier Vereine betreut,
    // richtet sich in jedem nach dessen Entscheidung.
    it('unterscheidet die Vereine desselben Kontos', () => {
      const fixture = render(
        { permissions: { create_player: true } } as Partial<User>,
        { clubId: '114' }
      );
      freigeben([
        { id: 113, manage_players: true },
        { id: 114, manage_players: false },
      ]);
      fixture.detectChanges(false);

      expect(fixture.componentInstance.createNotAllowed).toBe(true);
    });

    // Scheitert der Abruf, bleibt es bei der Näherung über `club_ids`, also
    // beim Verhalten von vorher. Ohne den eigenen error-Zweig würfe der
    // ErrorInterceptor bei 403 aus der Maske.
    it('faellt bei gescheitertem Abruf auf die Vereinsliste zurueck', () => {
      const fixture = render({
        club_ids: [113],
        permissions: { create_player: true },
      } as Partial<User>);
      TestBed.inject(HttpTestingController)
        .expectOne(`${environment.apiURL}vm/clubs_and_teams.json`)
        .flush(
          { message: 'Keine Berechtigung.' },
          { status: 403, statusText: 'Forbidden' }
        );
      fixture.detectChanges(false);

      expect(fixture.componentInstance.manageableClubIds).toBeNull();
      expect(fixture.componentInstance.createNotAllowed).toBe(false);
    });

    // Der 403 ist die erwartete Antwort und keine Stoerung: Er gehoert nicht
    // ins Monitoring.
    it('meldet den 403 der Vereinsliste nicht an den globalen ErrorHandler', () => {
      const fixture = render({
        permissions: { create_player: true },
      } as Partial<User>);
      // Erst nach `render`: `TestBed.inject` instanziiert das Testmodul, und
      // danach lehnt `overrideProvider` im Render-Helfer ab.
      const handleError = spyOn(TestBed.inject(ErrorHandler), 'handleError');
      TestBed.inject(HttpTestingController)
        .expectOne(`${environment.apiURL}vm/clubs_and_teams.json`)
        .flush(
          { message: 'Keine Berechtigung.' },
          { status: 403, statusText: 'Forbidden' }
        );
      fixture.detectChanges(false);

      expect(handleError).not.toHaveBeenCalled();
    });

    // Jeder andere Status dagegen schon. Faellt der Endpunkt mit 500 aus,
    // bekommt ein Teammanager eines freigegebenen Vereins die Maske lesend mit
    // der inhaltlich falschen Begruendung „das darf nur der Vereinsmanager" --
    // ein error-Zweig, der alles verschluckt, naehme genau diesen Fall lautlos
    // aus dem Monitoring.
    it('meldet einen Ausfall der Vereinsliste an den globalen ErrorHandler', () => {
      const fixture = render({
        permissions: { create_player: true },
      } as Partial<User>);
      const handleError = spyOn(TestBed.inject(ErrorHandler), 'handleError');
      TestBed.inject(HttpTestingController)
        .expectOne(`${environment.apiURL}vm/clubs_and_teams.json`)
        .flush(
          { message: 'Fehler.' },
          { status: 500, statusText: 'Server Error' }
        );
      fixture.detectChanges(false);

      expect(handleError).toHaveBeenCalled();
      // Die Naeherung bleibt: Der Ausfall darf die Maske nicht zusaetzlich
      // umbauen, er wird nur gemeldet.
      expect(fixture.componentInstance.manageableClubIds).toBeNull();
    });

    // Einer Verbandsrolle antwortet der Endpunkt mit 403, er ist die
    // Vereinssicht. Für sie wird er deshalb gar nicht erst gerufen.
    it('fragt die Vereinsliste fuer Admin und SBK nicht ab', () => {
      render({
        permissions: { create_player: true, update_player: true },
      } as Partial<User>);

      TestBed.inject(HttpTestingController).expectNone(
        `${environment.apiURL}vm/clubs_and_teams.json`
      );
    });
  });

  // Die Knöpfe zum Deaktivieren und Reaktivieren im Profil folgen derselben
  // Freigabe wie die Vereinsliste. Weil sie am Verein hängt, kann das
  // Rollen-Flag `player_deactivate` sie nicht steuern: Es gilt global.
  describe('Deaktivieren im Profil', () => {
    function build(
      permissions: Record<string, boolean>,
      player: Partial<Player>
    ): PlayerEditComponent {
      const component =
        TestBed.createComponent(PlayerEditComponent).componentInstance;
      component.permissions = permissions;
      component.editMode = true;
      component.player = player as Player;
      return component;
    }

    it('zeigt die Knoepfe, wenn das Profil sie erlaubt', () => {
      const component = build(
        { player_deactivate: false },
        {
          id: 7,
          can_deactivate: true,
        }
      );

      expect(component.canDeactivate).toBe(true);
      expect(component.canReactivate).toBe(false);
    });

    it('verbirgt sie, wenn das Profil sie verneint', () => {
      const component = build(
        { player_deactivate: true },
        {
          id: 7,
          can_deactivate: false,
        }
      );

      expect(component.canDeactivate).toBe(false);
      expect(component.canReactivate).toBe(false);
    });

    it('bietet Reaktivieren am deaktivierten Profil an', () => {
      const component = build(
        { player_deactivate: false },
        {
          id: 7,
          can_deactivate: true,
          deactivated_at: '2026-08-01T10:00:00Z',
        }
      );

      expect(component.canReactivate).toBe(true);
      expect(component.canDeactivate).toBe(false);
    });

    // Die Maske uebernimmt die Antwort auf die Aktion ungefiltert
    // (`this.player = updated`) und leitet den Gegenknopf daraus ab. Solange
    // die Antwort das Feld traegt, bleibt er stehen; ohne griff der Rueckfall
    // auf das globale Rollen-Flag, und einem reinen Teammanager fehlte
    // „Reaktivieren" bis zum naechsten Seitenaufruf.
    it('behaelt den Gegenknopf nach dem Deaktivieren', () => {
      const component = build(
        { player_deactivate: false },
        { id: 7, can_deactivate: true }
      );

      component.deactivatePlayer();
      TestBed.inject(HttpTestingController)
        .expectOne(`${environment.apiURL}admin/players/7/deactivate.json`)
        .flush({
          id: 7,
          can_deactivate: true,
          deactivated_at: '2026-08-28T10:00:00Z',
        });

      expect(component.canReactivate).toBe(true);
      expect(component.canDeactivate).toBe(false);
    });

    it('behaelt den Gegenknopf nach dem Reaktivieren', () => {
      const component = build(
        { player_deactivate: false },
        { id: 7, can_deactivate: true, deactivated_at: '2026-08-28T10:00:00Z' }
      );

      component.reactivatePlayer();
      TestBed.inject(HttpTestingController)
        .expectOne(`${environment.apiURL}admin/players/7/reactivate.json`)
        .flush({ id: 7, can_deactivate: true });

      expect(component.canDeactivate).toBe(true);
      expect(component.canReactivate).toBe(false);
    });

    // Frontend-Deploy vor API-Deploy: Fehlt das Feld, gilt weiter das
    // Rollen-Flag, also genau das Verhalten von vorher.
    it('faellt ohne das Feld auf das Rollen-Flag zurueck', () => {
      expect(build({ player_deactivate: true }, { id: 7 }).canDeactivate).toBe(
        true
      );
      expect(build({ player_deactivate: false }, { id: 7 }).canDeactivate).toBe(
        false
      );
    });
  });

  describe('Dokument-Upload', () => {
    function build(): PlayerEditComponent {
      const component =
        TestBed.createComponent(PlayerEditComponent).componentInstance;
      component.player = { id: 7 } as Player;
      component.licenseDocuments = [
        { id: 1, document_type: 'use' } as LicenseDocument,
      ];
      return component;
    }

    it('names the document a new upload of the same type would replace', () => {
      const component = build();

      expect(component.documentToBeReplaced).toBeUndefined();

      component.uploadDocumentType = 'use';
      expect(component.documentToBeReplaced?.id).toBe(1);

      component.uploadDocumentType = 'id_copy';
      expect(component.documentToBeReplaced).toBeUndefined();
    });

    // Die Grenze steht auch serverseitig (LicenseDocument::MAX_FILE_SIZE). Ohne
    // die Vorprüfung liefe die Datei erst durch die Leitung und käme als 422
    // zurück.
    it('rejects a file above 10 MB without calling the API', () => {
      const component = build();
      const playerService = TestBed.inject(PlayerService);
      const upload = spyOn(playerService, 'uploadLicenseDocument');
      component.uploadDocumentType = 'id_copy';

      component.onDocumentFileSelected(
        fileEvent({ size: 11 * 1024 * 1024 } as File)
      );

      expect(upload).not.toHaveBeenCalled();
      expect(component.uploadErrorKey).toBe(
        'playerAdmin.edit.documentTooLarge'
      );
    });

    it('does nothing while no document type is selected', () => {
      const component = build();
      const playerService = TestBed.inject(PlayerService);
      const upload = spyOn(playerService, 'uploadLicenseDocument');

      component.onDocumentFileSelected(fileEvent({ size: 1024 } as File));

      expect(upload).not.toHaveBeenCalled();
      expect(component.uploadErrorKey).toBeNull();
    });

    function fileEvent(file: File): Event {
      return {
        target: { files: [file], value: 'c:\\fake' },
      } as unknown as Event;
    }
  });

  // Die Spielersuche geht ueber den gesamten Bestand, das Profil dahinter ist
  // auf den Heimat-Spielbetrieb begrenzt. Bis api#567 warf der 403 ueber den
  // ErrorInterceptor auf die Startseite, mitsamt der Suche, aus der der Aufruf
  // kam. Der Interceptor nimmt diesen einen Abruf jetzt aus, also muss die
  // Maske die Absage selbst zeigen -- sonst bliebe sie kommentarlos leer.
  describe('Profil ausserhalb der eigenen Zustaendigkeit', () => {
    function denyWith(status: number): void {
      spyOn(TestBed.inject(PlayerService), 'getPlayer').and.returnValue(
        throwError(() => new HttpErrorResponse({ status }))
      );
    }

    it('zeigt die Absage in der Maske', () => {
      denyWith(403);
      currentUser$.next({
        permissions: { menu_item_player_admin: true },
      } as unknown as User);

      const fixture = TestBed.createComponent(PlayerEditComponent);
      fixture.detectChanges(false);

      expect(fixture.componentInstance.loadDenied).toBe(true);
      expect(
        fixture.nativeElement.querySelector('[data-testid="load-denied"]')
      ).not.toBe(null);
    });

    // Jeder andere Status bleibt beim Interceptor, der ihn meldet. Ein 404 als
    // fehlende Zustaendigkeit auszugeben, waere schlicht falsch.
    //
    // Und er muss den globalen ErrorHandler erreichen: Das ist in Produktion
    // der Sentry-Handler, und ein error-Zweig, der alles verschluckt, haette
    // den 500 beim Oeffnen eines Profils lautlos aus dem Monitoring genommen.
    it('deutet einen anderen Fehler nicht als fehlende Zustaendigkeit', () => {
      const handleError = spyOn(TestBed.inject(ErrorHandler), 'handleError');
      denyWith(404);

      const fixture = TestBed.createComponent(PlayerEditComponent);
      fixture.detectChanges(false);

      expect(fixture.componentInstance.loadDenied).toBe(false);
      expect(
        fixture.nativeElement.querySelector('[data-testid="load-denied"]')
      ).toBe(null);
      expect(handleError).toHaveBeenCalled();
    });

    // Gegenprobe: Der 403 ist der eine Fall, den die Maske selbst beantwortet.
    // Er gehoert nicht ins Monitoring, er ist eine gueltige Antwort.
    it('meldet den 403 nicht an den globalen ErrorHandler', () => {
      const handleError = spyOn(TestBed.inject(ErrorHandler), 'handleError');
      denyWith(403);

      const fixture = TestBed.createComponent(PlayerEditComponent);
      fixture.detectChanges(false);

      expect(fixture.componentInstance.loadDenied).toBe(true);
      expect(handleError).not.toHaveBeenCalled();
    });

    // Nach einer Aktion laedt dieselbe Methode das offene Profil neu. Ein
    // Fehlschlag dort darf die gefuellte Maske nicht gegen einen Hinweis
    // tauschen, gemeldet werden muss er trotzdem: Der Interceptor tut es in
    // diesem einen Fall nicht mehr.
    it('tauscht ein bereits geoeffnetes Profil nicht gegen den Hinweis', () => {
      const notify = spyOn(TestBed.inject(NotificationService), 'error');
      denyWith(403);

      const component =
        TestBed.createComponent(PlayerEditComponent).componentInstance;
      component.player = { id: 7 } as Player;
      component.getPlayer('7');

      expect(component.loadDenied).toBe(false);
      expect(notify).toHaveBeenCalled();
    });

    // Die Komponente haengt an `route.params` und ueberlebt einen
    // Parameterwechsel. Wer von einem erlaubten auf ein gesperrtes Profil
    // wechselt, darf nicht das alte unter der neuen Adresse weiterlesen und
    // bearbeiten -- deshalb entscheidet die angefragte id und nicht die blosse
    // Anwesenheit eines Profils.
    it('raeumt das vorige Profil beim Wechsel auf ein gesperrtes ab', () => {
      denyWith(403);

      const component =
        TestBed.createComponent(PlayerEditComponent).componentInstance;
      component.player = { id: 7 } as Player;
      component.getPlayer('8');

      expect(component.loadDenied).toBe(true);
      expect(component.player).toBeUndefined();
    });

    // Der Hinweis ersetzt die Maske, er steht nicht darueber: Ohne diese
    // Bedingungen drehten sich darunter zwei Ladekreisel weiter und die Karte
    // „Freigaben" bot einen Knopf an, der ohne Spieler-id ins Leere greift.
    it('laesst unter dem Hinweis nichts Bedienbares stehen', () => {
      denyWith(403);
      currentUser$.next({
        permissions: {
          menu_item_player_admin: true,
          player_add_additional_clubs: true,
        },
      } as unknown as User);

      const fixture = TestBed.createComponent(PlayerEditComponent);
      fixture.detectChanges(false);

      const dom = fixture.nativeElement;
      expect(dom.querySelector('[data-testid="load-denied"]')).not.toBe(null);
      expect(dom.querySelector('.animate-spin')).toBe(null);
      expect(dom.textContent).not.toContain('playerAdmin.edit.releases');
      expect(dom.querySelector('button')).toBe(null);
    });
  });
  // Löschen ist der einzige Statuswechsel mit Pflicht-Begründung. Ob eine Lizenz
  // überhaupt löschbar ist, entscheidet die API je Lizenz (License.deletable?:
  // laufende Saison, Status erteilt oder beantragt) und liefert es als
  // `delete_allowed` mit. Die Maske baut die Regel nicht nach, sie liest sie.
  describe('Lizenz löschen', () => {
    function license(deleteAllowed?: boolean): PlayerLicense {
      return {
        id: 'lizenz-1',
        team_id: 1,
        season_id: 18,
        league_class_id: '',
        requested_at: '',
        history: [{ license_status_id: 1 }],
        delete_allowed: deleteAllowed,
      } as unknown as PlayerLicense;
    }

    function build(
      permissions: Record<string, boolean>,
      licenses: PlayerLicense[]
    ): PlayerEditComponent {
      currentUser$.next({ permissions } as unknown as User);
      const fixture = TestBed.createComponent(PlayerEditComponent);
      fixture.componentInstance.player = { id: 7, licenses } as Player;
      fixture.detectChanges(false);
      return fixture.componentInstance;
    }

    it('bietet das Löschen an, wenn Recht und Auskunft der API zusammenkommen', () => {
      const lic = license(true);
      const component = build({ player_delete_license: true }, [lic]);

      expect(component.canDeleteLicense(lic)).toBe(true);
    });

    it('bietet es ohne das Recht nicht an', () => {
      const lic = license(true);
      const component = build({}, [lic]);

      expect(component.canDeleteLicense(lic)).toBe(false);
    });

    // Eine gesperrte, abgelehnte oder abgelaufene Lizenz kommt mit
    // delete_allowed: false. Der Knopf darf dort nicht stehen, sonst führte er
    // in ein 422.
    it('bietet es nicht an, wenn die API die Lizenz nicht freigibt', () => {
      const lic = license(false);
      const component = build({ player_delete_license: true }, [lic]);

      expect(component.canDeleteLicense(lic)).toBe(false);
    });

    // Frontend-Deploy vor API-Deploy: Fehlt das Feld, ist die API älter. Dann
    // lieber kein Knopf als einer, dessen Endpunkt den Status noch nicht kennt.
    it('bietet es nicht an, wenn die API das Feld nicht liefert', () => {
      const lic = license(undefined);
      const component = build({ player_delete_license: true }, [lic]);

      expect(component.canDeleteLicense(lic)).toBe(false);
    });

    it('schickt den Status 4 mit der Begründung', () => {
      const lic = license(true);
      const component = build({ player_delete_license: true }, [lic]);

      component.openLicenseDelete(lic);
      component.licenseDeleteReason = '  auf der falschen Mannschaft  ';
      component.submitLicenseDelete(lic);

      const req = TestBed.inject(HttpTestingController).expectOne(
        `${environment.apiURL}admin/players/7/handle_license_request.json`
      );
      expect(req.request.body.license_id).toBe('lizenz-1');
      expect(req.request.body.license_status_id).toBe(4);
      // Getrimmt wie in der API, sonst stünde die Begründung mit Leerzeichen
      // in der Historie.
      expect(req.request.body.reason).toBe('auf der falschen Mannschaft');
      req.flush({ success: true });

      expect(component.deleteLicenseId).toBe(null);
    });

    // Die API weist eine Begründung aus lauter Leerzeichen ab. Die Maske soll
    // dafür gar nicht erst losschicken.
    it('schickt ohne Begründung nichts', () => {
      const lic = license(true);
      const component = build({ player_delete_license: true }, [lic]);

      component.openLicenseDelete(lic);
      component.licenseDeleteReason = '   ';
      component.submitLicenseDelete(lic);

      TestBed.inject(HttpTestingController).expectNone(
        `${environment.apiURL}admin/players/7/handle_license_request.json`
      );
    });

    it('räumt das Formular beim Abbrechen ab', () => {
      const lic = license(true);
      const component = build({ player_delete_license: true }, [lic]);

      component.openLicenseDelete(lic);
      component.licenseDeleteReason = 'Tippfehler';
      component.cancelLicenseDelete();

      expect(component.deleteLicenseId).toBe(null);
      expect(component.licenseDeleteReason).toBe('');
    });
  });
});
