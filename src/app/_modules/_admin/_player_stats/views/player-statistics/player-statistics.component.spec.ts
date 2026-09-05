import {
  ComponentFixture,
  TestBed,
  discardPeriodicTasks,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import {
  HttpClientTestingModule,
  HttpTestingController,
  TestRequest,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { getTranslocoTestingModule } from '@floorball/core';
import { UikitCommonModule } from '@floorball/uikit/common';
import {
  PlayerStatisticsEntry,
  PlayerStatisticsExportResponse,
  PlayerStatisticsResponse,
} from '@floorball/types';
import { environment } from 'src/environments/environment';

import { PlayerStatisticsComponent } from './player-statistics.component';

const URL = `${environment.apiURL}admin/player_statistics.json`;
const EXPORT_URL = `${environment.apiURL}admin/player_statistics/export.json`;

/**
 * Typisiert, nicht `Record<string, unknown>`: Sonst prueft der Uebersetzer die
 * Testantworten nicht gegen den Vertrag, und die Fixture kann Zustaende bauen,
 * die die API nie liefert (ein Verbandsscope ohne `global` etwa). Jede
 * Verschaerfung der Typen waere hier sonst wirkungslos.
 */
function response(
  overrides: Partial<PlayerStatisticsResponse> = {}
): PlayerStatisticsResponse {
  return {
    scope: { mode: 'club', club: { id: 113, name: 'TSV Beispiel' } },
    as_of: '2026-08-29T01:15:00.000Z',
    total: 1,
    page: 1,
    per_page: 50,
    players: [],
    filters: {
      seasons: [
        { id: '18', name: '2026/2027' },
        { id: '17', name: '2025/2026' },
      ],
      game_operations: [{ id: 2, name: 'SBK Ost', short_name: 'Ost' }],
      league_classes: [{ id: 'herren', name: 'Herren' }],
      leagues: [
        {
          id: 900,
          name: 'Landesliga Ost',
          season_id: '17',
          league_class_id: 'herren',
        },
      ],
      teams: [{ id: 5, name: 'TSV Beispiel 1' }],
    },
    ...overrides,
  };
}

/** Eine vollstaendige Zeile; die Werte sind je Spalte unterscheidbar. */
function zeile(
  overrides: Partial<PlayerStatisticsEntry> = {}
): PlayerStatisticsEntry {
  return {
    player_id: 42,
    first_name: 'Alex',
    last_name: 'Beispiel',
    deactivated_at: null,
    games: 10,
    goals: 4,
    assists: 3,
    scorer_points: 7,
    scorer_per_game: 0.7,
    goals_per_game: 0.4,
    assists_per_game: 0.3,
    penalty_minutes: 6,
    first_season_id: '17',
    last_season_id: '18',
    ...overrides,
  };
}

function exportResponse(
  overrides: Partial<PlayerStatisticsExportResponse> = {}
): PlayerStatisticsExportResponse {
  return {
    scope: { mode: 'club', club: { id: 113, name: 'TSV Beispiel' } },
    as_of: '2026-08-29T01:15:00.000Z',
    total: 1,
    truncated: false,
    players: [zeile()],
    ...overrides,
  };
}

describe('PlayerStatisticsComponent', () => {
  let http: HttpTestingController;

  // Bewusst synchron und ohne compileComponents: Die Vorlage wird ohnehin
  // ersetzt, und ein await vertruege sich nicht mit fakeAsync im Debounce-Test.
  function setup(clubId: string | null) {
    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [PlayerStatisticsComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap(clubId ? { clubId } : {})),
          },
        },
      ],
    }).overrideTemplate(PlayerStatisticsComponent, '');

    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(PlayerStatisticsComponent);
    fixture.detectChanges();
    return fixture;
  }

  /**
   * Die eine offene Abfrage dieses Schritts.
   *
   * `match` nimmt die Treffer aus der Warteschlange, der Rueckgabewert muss
   * also festgehalten werden -- ein zweiter Aufruf fand nichts mehr. Die
   * Laengenbehauptung ist kein Beiwerk: Ohne sie verschluckt `match` einen
   * doppelten Abruf (zwei `_load$.next()` fuer eine Bedienung), und
   * `http.verify()` merkt davon nichts.
   */
  function lastRequest(): TestRequest {
    const requests = http.match((req) => req.url === URL);
    expect(requests.length).toBe(1);
    return requests[0];
  }

  afterEach(() => http.verify());

  it('fragt die Vereinsansicht mit club_id und den Vorbelegungen ab', () => {
    const fixture = setup('113');

    const req = lastRequest();
    expect(req.request.params.get('club_id')).toBe('113');
    expect(req.request.params.get('sort')).toBe('games');
    expect(req.request.params.get('sort_dir')).toBe('desc');
    expect(req.request.params.get('min_games')).toBe('1');
    expect(req.request.params.get('only_current_members')).toBe('true');
    expect(req.request.params.get('page')).toBe('1');
    req.flush(response());

    expect(fixture.componentInstance.isAssociationMode).toBeFalse();
    expect(fixture.componentInstance.filterOptions?.seasons.length).toBe(2);
  });

  // Ohne :clubId ist die Verbandsansicht gemeint. Ginge club_id trotzdem mit
  // (etwa als leerer Wert), antwortete die API im Vereinsmodus.
  it('laesst club_id in der Verbandsansicht ganz weg', () => {
    const fixture = setup(null);

    const req = lastRequest();
    expect(req.request.params.has('club_id')).toBeFalse();
    req.flush(
      response({
        scope: { mode: 'association', global: false },
        filters: {
          seasons: [],
          game_operations: [],
          league_classes: [],
          clubs: [{ id: 7, name: 'SC Beispiel' }],
        },
      })
    );

    expect(fixture.componentInstance.isAssociationMode).toBeTrue();
  });

  // Regression-Risiko: Die API liefert die Auswahllisten NUR mit Seite 1. Wer
  // sie beim Blaettern uebernimmt, raeumt auf Seite 2 alle Filterfelder leer.
  it('behaelt die Auswahllisten beim Blaettern', () => {
    const fixture = setup('113');
    lastRequest().flush(response({ total: 120 }));

    fixture.componentInstance.changePage(2);
    const req = lastRequest();
    expect(req.request.params.get('page')).toBe('2');
    req.flush(response({ page: 2, total: 120, filters: undefined }));

    expect(fixture.componentInstance.filterOptions?.seasons.length).toBe(2);
  });

  it('kehrt die Richtung um und beginnt wieder bei Seite 1', () => {
    const fixture = setup('113');
    lastRequest().flush(response({ total: 120 }));

    fixture.componentInstance.changePage(2);
    lastRequest().flush(response({ page: 2, total: 120, filters: undefined }));

    fixture.componentInstance.sortBy('games');
    const req = lastRequest();
    expect(req.request.params.get('sort_dir')).toBe('asc');
    expect(req.request.params.get('page')).toBe('1');
    req.flush(response({ total: 120 }));
  });

  it('sortiert Namen aufsteigend, Zahlen absteigend', () => {
    const fixture = setup('113');
    lastRequest().flush(response());

    fixture.componentInstance.sortBy('name');
    let req = lastRequest();
    expect(req.request.params.get('sort')).toBe('name');
    expect(req.request.params.get('sort_dir')).toBe('asc');
    req.flush(response());

    fixture.componentInstance.sortBy('scorer_points');
    req = lastRequest();
    expect(req.request.params.get('sort_dir')).toBe('desc');
    req.flush(response());
  });

  // Der Debounce haengt an einem RxJS-Operator; jasmine.clock erreicht ihn
  // nicht, deshalb fakeAsync/tick.
  it('fragt die Namenssuche erst nach dem Debounce ab', fakeAsync(() => {
    const fixture = setup('113');
    lastRequest().flush(response());

    fixture.componentInstance.onSearchChange('mus');
    fixture.componentInstance.onSearchChange('must');
    expect(http.match((req) => req.url === URL).length).toBe(0);

    tick(300);
    const req = lastRequest();
    expect(req.request.params.get('q')).toBe('must');
    req.flush(response());
  }));

  // Eine Liga, die zur neuen Saisonwahl gar nicht mehr angeboten wird, bliebe
  // sonst als unsichtbarer Filter stehen -- die Liste waere ohne erkennbaren
  // Grund leer.
  it('verwirft eine Liga, die zur neuen Saisonwahl nicht mehr passt', () => {
    const fixture = setup('113');
    lastRequest().flush(response());

    const component = fixture.componentInstance;
    component.leagueId = 900;
    component.toggleSeason('18');

    expect(component.leagueId).toBeNull();
    const req = lastRequest();
    expect(req.request.params.has('league_id')).toBeFalse();
    expect(req.request.params.get('season_id')).toBe('18');
    req.flush(response({ players: [], total: 0 }));
  });

  // 503 aus dem Endpunkt (Aggregat nicht erreichbar): Die Meldung der API
  // gehoert in die Maske, und der Strom muss weiterleben.
  it('zeigt den Grund eines gescheiterten Abrufs und laedt danach weiter', () => {
    const fixture = setup('113');
    lastRequest().flush(
      { error: 'Spielerdaten konnten nicht geladen werden.' },
      { status: 503, statusText: 'Service Unavailable' }
    );

    const component = fixture.componentInstance;
    expect(component.loadError).toBe(
      'Spielerdaten konnten nicht geladen werden.'
    );
    expect(component.loading).toBeFalse();

    component.reload();
    lastRequest().flush(response());
    expect(component.loadError).toBeNull();
  });

  it('nimmt in der Vereinsansicht den Verein der Route fuer den Bearbeiten-Link', () => {
    const fixture = setup('113');
    lastRequest().flush(response());

    expect(fixture.componentInstance.editClubId({ home_club_id: 999 })).toBe(
      113
    );
  });

  // In der Verbandsansicht steht der Verein je Zeile; ohne ihn (kein laufender
  // Heimatverein) gibt es keinen Pfad in die Pflegemaske.
  it('nimmt in der Verbandsansicht den Heimatverein der Zeile', () => {
    const fixture = setup(null);
    lastRequest().flush(
      response({ scope: { mode: 'association', global: false } })
    );

    const component = fixture.componentInstance;
    expect(component.editClubId({ home_club_id: 7 })).toBe(7);
    expect(component.editClubId({ home_club_id: null })).toBeNull();
  });

  // Regression: `resetFilters` setzt `search` direkt und laesst den Suchstrom
  // unberuehrt. Mit `distinctUntilChanged` verwarf der Strom denselben Begriff
  // beim zweiten Tippen als Wiederholung -- im Feld stand ein Name, darunter
  // die ungefilterte Rangliste, und `hasActiveFilters` verriet nichts davon.
  it('sucht denselben Begriff nach dem Zuruecksetzen erneut', fakeAsync(() => {
    const fixture = setup('113');
    lastRequest().flush(response());
    const component = fixture.componentInstance;

    component.onSearchChange('must');
    tick(300);
    const erste = lastRequest();
    expect(erste.request.params.get('q')).toBe('must');
    erste.flush(response());

    component.resetFilters();
    lastRequest().flush(response());
    expect(component.search).toBe('');

    component.onSearchChange('must');
    tick(300);
    const req = lastRequest();
    expect(req.request.params.get('q')).toBe('must');
    expect(component.search).toBe('must');
    req.flush(response());
  }));

  // Regression: Die API engt `filter_options` mit gesetztem `club_filter_id`
  // auf diesen einen Verein ein (er laeuft dort in `counted_club_ids`). Wer die
  // Listen unbesehen uebernimmt, hat danach ein Vereins-Dropdown mit einem
  // Eintrag und kann Saison oder Altersklasse als unsichtbaren Filter
  // stehenlassen, ohne sie noch abwaehlen zu koennen.
  it('uebernimmt die eingeengten Auswahllisten des Vereinsfilters nicht', () => {
    const fixture = setup(null);
    const component = fixture.componentInstance;
    lastRequest().flush(
      response({
        scope: { mode: 'association', global: false },
        filters: {
          seasons: [
            { id: '18', name: '2026/2027' },
            { id: '17', name: '2025/2026' },
          ],
          game_operations: [],
          league_classes: [],
          clubs: [
            { id: 7, name: 'SC Beispiel' },
            { id: 8, name: 'TSV Zweitverein' },
          ],
        },
      })
    );

    component.clubFilterId = 7;
    component.onFilterChange();
    const req = lastRequest();
    expect(req.request.params.get('club_filter_id')).toBe('7');
    req.flush(
      response({
        scope: { mode: 'association', global: false },
        filters: {
          seasons: [{ id: '18', name: '2026/2027' }],
          game_operations: [],
          league_classes: [],
          clubs: [{ id: 7, name: 'SC Beispiel' }],
        },
      })
    );

    expect(component.filterOptions?.clubs?.length).toBe(2);
    expect(component.filterOptions?.seasons.length).toBe(2);
  });

  // Ein Tippfehler in einem dieser Namen wird von der API stumm ignoriert, und
  // die Rangliste zeigt den ungefilterten Bestand unter einem gesetzten
  // Dropdown. Deshalb alle Filter zugleich, nicht einer je Test.
  it('schickt jeden gesetzten Filter unter seinem Namen mit', () => {
    const fixture = setup('113');
    lastRequest().flush(response());
    const component = fixture.componentInstance;

    component.gameOperationId = 2;
    component.leagueClassId = 'herren';
    component.leagueId = 900;
    component.teamId = 5;
    component.gender = 'W';
    component.includeDeactivated = true;
    component.onlyCurrentMembers = false;
    component.onFilterChange();

    const req = lastRequest();
    const params = req.request.params;
    expect(params.get('game_operation_id')).toBe('2');
    expect(params.get('league_class_id')).toBe('herren');
    expect(params.get('league_id')).toBe('900');
    expect(params.get('team_id')).toBe('5');
    expect(params.get('gender')).toBe('W');
    expect(params.get('include_deactivated')).toBe('true');
    expect(params.get('only_current_members')).toBe('false');
    expect(params.get('per_page')).toBe('50');
    req.flush(response());
  });

  // `club_filter_id` ist der einzige moduskritische Zweig im Query-Getter.
  // Dreht er sich, verschwindet der Vereinsfilter in der Verbandsansicht und in
  // der Vereinsansicht geht ein zweiter, widersprechender Verein mit.
  it('sendet den Vereinsfilter nur in der Verbandsansicht', () => {
    const verband = setup(null);
    lastRequest().flush(
      response({ scope: { mode: 'association', global: true } })
    );
    verband.componentInstance.clubFilterId = 7;
    verband.componentInstance.onFilterChange();
    const mitFilter = lastRequest();
    expect(mitFilter.request.params.get('club_filter_id')).toBe('7');
    mitFilter.flush(response({ scope: { mode: 'association', global: true } }));

    TestBed.resetTestingModule();
    const verein = setup('113');
    lastRequest().flush(response());
    verein.componentInstance.clubFilterId = 7;
    verein.componentInstance.onFilterChange();
    const ohneFilter = lastRequest();
    expect(ohneFilter.request.params.has('club_filter_id')).toBeFalse();
    ohneFilter.flush(response());
  });

  it('beginnt auch bei einem Filterwechsel von Seite 2 wieder bei Seite 1', () => {
    const fixture = setup('113');
    lastRequest().flush(response({ total: 120 }));

    fixture.componentInstance.changePage(2);
    lastRequest().flush(response({ page: 2, total: 120, filters: undefined }));
    expect(fixture.componentInstance.firstRank).toBe(51);

    fixture.componentInstance.gender = 'W';
    fixture.componentInstance.onFilterChange();
    const req = lastRequest();
    expect(req.request.params.get('page')).toBe('1');
    req.flush(response({ total: 120 }));
    expect(fixture.componentInstance.firstRank).toBe(1);
  });

  // Die Rangnummer ist in einer Rangliste die Aussage. Rechnet sie falsch,
  // steht auf Seite 2 eine glaubwuerdige, falsche Zahlenreihe.
  it('nimmt die Seitengroesse der Antwort fuer Rang und Seitenzahl', () => {
    const fixture = setup('113');
    lastRequest().flush(response({ total: 60, per_page: 25 }));
    const component = fixture.componentInstance;

    expect(component.perPage).toBe(25);
    expect(component.numberOfPages).toBe(3);

    component.changePage(3);
    lastRequest().flush(
      response({ page: 3, total: 60, per_page: 25, filters: undefined })
    );
    expect(component.firstRank).toBe(51);
  });

  // Ohne diesen Riegel landete ein SyntaxError-Objekt als Text im Kasten:
  // Scheitert das Parsen, legt Angular es in err.error.error ab, und `??`
  // laeuft daran vorbei.
  it('zeigt nur Zeichenketten aus der Antwort als Fehlertext', () => {
    const fixture = setup('113');
    lastRequest().flush(
      { error: new SyntaxError('Unexpected token <'), text: '<html>' },
      { status: 500, statusText: 'Internal Server Error' }
    );

    expect(fixture.componentInstance.loadError).toBe('playerStats.loadError');
  });

  it('laedt nach einem Fehlschlag auf Wunsch dieselbe Abfrage erneut', () => {
    const fixture = setup('113');
    lastRequest().flush(
      { error: 'Spielerdaten konnten nicht geladen werden.' },
      { status: 503, statusText: 'Service Unavailable' }
    );

    fixture.componentInstance.retry();
    const req = lastRequest();
    expect(req.request.params.get('page')).toBe('1');
    req.flush(response());
    expect(fixture.componentInstance.loadError).toBeNull();
  });

  // Die Mindestzahl feuerte pro Tastendruck (im Verbandsmodus je eine
  // Aggregatabfrage) und schrieb die Korrektur auf 1 mitten in die Eingabe.
  it('entprellt die Mindestzahl und schreibt den geklemmten Wert zurueck', fakeAsync(() => {
    const fixture = setup('113');
    lastRequest().flush(response());
    const component = fixture.componentInstance;

    component.onMinGamesChange('2');
    component.onMinGamesChange('25');
    expect(http.match((req) => req.url === URL).length).toBe(0);

    tick(300);
    expect(component.minGames).toBe(25);
    const req = lastRequest();
    expect(req.request.params.get('min_games')).toBe('25');
    req.flush(response());

    component.onMinGamesChange('');
    tick(300);
    expect(component.minGames).toBe(1);
    lastRequest().flush(response());
  }));

  // Anderer Verein heisst anderer Blick. Blieben die Auswahllisten stehen,
  // stuenden im Mannschaftsfeld die Mannschaften des vorigen Vereins, und wer
  // eine waehlt, bekommt eine leere Liste ohne erkennbaren Grund.
  it('verwirft Auswahllisten, Filter und Kopf beim Vereinswechsel', () => {
    const params$ = new BehaviorSubject(convertToParamMap({ clubId: '113' }));
    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [PlayerStatisticsComponent],
      providers: [{ provide: ActivatedRoute, useValue: { paramMap: params$ } }],
    }).overrideTemplate(PlayerStatisticsComponent, '');
    http = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(PlayerStatisticsComponent);
    fixture.detectChanges();
    lastRequest().flush(response());
    const component = fixture.componentInstance;
    component.teamId = 5;

    params$.next(convertToParamMap({ clubId: '114' }));

    expect(component.clubId).toBe(114);
    expect(component.filterOptions).toBeNull();
    expect(component.scope).toBeNull();
    expect(component.teamId).toBeNull();
    const req = lastRequest();
    expect(req.request.params.get('club_id')).toBe('114');
    req.flush(
      response({ scope: { mode: 'club', club: { id: 114, name: 'B' } } })
    );
  });

  it('setzt die Filter auf die Vorbelegung zurueck', () => {
    const fixture = setup('113');
    lastRequest().flush(response());

    const component = fixture.componentInstance;
    component.includeDeactivated = true;
    component.minGames = 10;
    component.onFilterChange();
    lastRequest().flush(response());
    expect(component.hasActiveFilters).toBeTrue();

    component.resetFilters();
    const req = lastRequest();
    expect(req.request.params.get('min_games')).toBe('1');
    expect(req.request.params.get('include_deactivated')).toBe('false');
    req.flush(response());
    expect(component.hasActiveFilters).toBeFalse();
  });

  it('schreibt den Zeitraum aus den Saisonnamen', () => {
    const fixture = setup('113');
    lastRequest().flush(response());

    const component = fixture.componentInstance;
    expect(
      component.period(zeile({ first_season_id: '17', last_season_id: '18' }))
    ).toBe('2025/2026 – 2026/2027');
    expect(
      component.period(zeile({ first_season_id: '17', last_season_id: '17' }))
    ).toBe('2025/2026');
    // Fehlt die erste Saison, darf kein halber Zeitraum mit fuehrendem
    // Trenner herauskommen.
    expect(
      component.period(zeile({ first_season_id: null, last_season_id: '18' }))
    ).toBe('2026/2027');
    expect(
      component.period(zeile({ first_season_id: null, last_season_id: null }))
    ).toBe('–');
  });
  /**
   * Die Uebrigen ersetzen die Vorlage, um sich auf den Zustand zu
   * beschraenken. Hier laeuft sie echt, denn genau dort sitzt eine Klasse von
   * Fehlern, die nichts wirft und plausibel aussieht: eine Zahl unter der
   * falschen Ueberschrift, eine falsche Rangnummer, eine Blaetterleiste, die
   * nicht blaettert.
   */
  // Der Export ist die eigentliche Arbeitsgrundlage: Wer die Zahlen im
  // Tabellenblatt weiterverarbeitet, braucht die ganze Filterauswahl. Die
  // Ansicht blaettert serverseitig, `entries` sind nur die sichtbaren 50 Zeilen.
  describe('Export', () => {
    let blobs: Blob[];

    function setupExport(clubId: string | null) {
      TestBed.configureTestingModule({
        imports: [
          HttpClientTestingModule,
          RouterTestingModule,
          getTranslocoTestingModule({
            de: {
              playerStats: {
                exportError: 'Der Export konnte nicht erstellt werden.',
                columns: {
                  club: 'Verein',
                  games: 'Spiele',
                  goals: 'Tore',
                  assists: 'Vorlagen',
                  points: 'Punkte',
                  pointsPerGame: 'Punkte/Spiel',
                },
                csv: {
                  lastName: 'Nachname',
                  firstName: 'Vorname',
                  penaltyMinutes: 'Strafminuten',
                  firstSeason: 'Erste Saison',
                  lastSeason: 'Letzte Saison',
                  deactivated: 'Deaktiviert',
                  playerId: 'Spieler-ID',
                  yes: 'Ja',
                  no: 'Nein',
                },
              },
            },
          }),
        ],
        declarations: [PlayerStatisticsComponent],
        providers: [
          {
            provide: ActivatedRoute,
            useValue: {
              paramMap: of(convertToParamMap(clubId ? { clubId } : {})),
            },
          },
        ],
      }).overrideTemplate(PlayerStatisticsComponent, '');

      http = TestBed.inject(HttpTestingController);
      // downloadCsv haengt seine Datei an ein <a> und klickt es an. Der Klick
      // bleibt hier stumm, der Inhalt wird ueber den Blob gelesen.
      blobs = [];
      // globalThis.URL, weil `URL` in dieser Datei die Endpunkt-Konstante ist.
      spyOn(globalThis.URL, 'createObjectURL').and.callFake(
        (blob: Blob | MediaSource) => {
          blobs.push(blob as Blob);
          return 'blob:test';
        }
      );
      spyOn(globalThis.URL, 'revokeObjectURL');
      spyOn(HTMLAnchorElement.prototype, 'click');

      const fixture = TestBed.createComponent(PlayerStatisticsComponent);
      fixture.detectChanges();
      return fixture;
    }

    function lastExportRequest(): TestRequest {
      const requests = http.match((req) => req.url === EXPORT_URL);
      expect(requests.length).toBe(1);
      return requests[0];
    }

    /** Zeilen der Datei ohne das UTF-8-BOM am Anfang. */
    async function csvLines(blob: Blob): Promise<string[]> {
      return (await blob.text()).replace(/^\uFEFF/, '').split('\r\n');
    }

    // Such- und Mindestspielfeld wirken erst nach 300 ms auf `search` bzw.
    // `minGames`. In diesem Fenster lieferte der Export die Datei zum VORIGEN
    // Filterstand, ohne Ladezustand und ohne Hinweis: eine vollstaendig
    // aussehende Datei, die nicht zur Maske passt.
    it('exportiert nicht, solange eine Filteraenderung im Debounce haengt', fakeAsync(() => {
      const fixture = setupExport('113');
      lastRequest().flush(response({ total: 120 }));
      const component = fixture.componentInstance;

      component.onMinGamesChange('10');
      expect(component.filterPending).toBeTrue();

      component.exportCsv();
      http.expectNone((req) => req.url === EXPORT_URL);

      tick(300);
      expect(component.filterPending).toBeFalse();
      lastRequest().flush(response({ total: 3 }));

      // Jetzt traegt der Export den neuen Stand.
      component.exportCsv();
      const req = lastExportRequest();
      expect(req.request.params.get('min_games')).toBe('10');
      req.flush(exportResponse());
      discardPeriodicTasks();
    }));

    // Die Blaetterung darf NICHT mitgehen: Mit `per_page` im Export bekaeme die
    // Datei genau die Seite, die man auch abschreiben koennte.
    it('schickt die Filterauswahl ohne die Blaetterung', () => {
      const fixture = setupExport('113');
      lastRequest().flush(response({ total: 120 }));

      const component = fixture.componentInstance;
      component.changePage(2);
      lastRequest().flush(
        response({ page: 2, total: 120, filters: undefined })
      );
      component.gender = 'W';
      component.seasonIds = ['17'];
      component.onFilterChange();
      lastRequest().flush(response({ total: 120 }));
      component.sortBy('goals');
      lastRequest().flush(response({ total: 120 }));

      component.exportCsv();

      const req = lastExportRequest();
      expect(req.request.params.has('page')).toBeFalse();
      expect(req.request.params.has('per_page')).toBeFalse();
      expect(req.request.params.get('club_id')).toBe('113');
      expect(req.request.params.get('gender')).toBe('W');
      expect(req.request.params.get('season_id')).toBe('17');
      expect(req.request.params.get('sort')).toBe('goals');
      req.flush(exportResponse());
    });

    // Kopfzeile und Zeile stehen im Code untereinander, aber eine vertauschte
    // Spalte ergibt eine glaubwuerdige Datei mit falschen Werten.
    it('schreibt die Spalten in der Reihenfolge der Kopfzeile', async () => {
      const fixture = setupExport('113');
      lastRequest().flush(response({ total: 1 }));

      fixture.componentInstance.exportCsv();
      lastExportRequest().flush(
        exportResponse({
          players: [zeile({ scorer_per_game: 0.7, deactivated_at: null })],
        })
      );

      expect(blobs.length).toBe(1);
      const [header, row] = await csvLines(blobs[0]);
      expect(header).toBe(
        '"Nachname";"Vorname";"Spiele";"Tore";"Vorlagen";"Punkte";' +
          '"Punkte/Spiel";"Strafminuten";"Erste Saison";"Letzte Saison";' +
          '"Deaktiviert";"Spieler-ID"'
      );
      // Dezimalkomma, Saisonnamen statt IDs -- beides fuer die Tabellenkalkulation.
      expect(row).toBe(
        '"Beispiel";"Alex";"10";"4";"3";"7";"0,70";"6";"2025/2026";' +
          '"2026/2027";"Nein";"42"'
      );
    });

    // In der Vereinsansicht ist der Verein fuer jede Zeile derselbe und steht
    // im Kopf der Seite; die API liefert ihn dort gar nicht mit.
    it('nennt den Verein nur in der Verbandsansicht', async () => {
      const fixture = setupExport(null);
      lastRequest().flush(
        response({ scope: { mode: 'association', global: true }, total: 1 })
      );

      fixture.componentInstance.exportCsv();
      lastExportRequest().flush(
        exportResponse({
          scope: { mode: 'association', global: true },
          players: [zeile({ home_club_id: 7, home_club: 'SC Beispiel' })],
        })
      );

      const [header, row] = await csvLines(blobs[0]);
      expect(header.split(';')[2]).toBe('"Verein"');
      expect(row.split(';')[2]).toBe('"SC Beispiel"');
    });

    it('markiert deaktivierte Personen', async () => {
      const fixture = setupExport('113');
      lastRequest().flush(response({ total: 1 }));

      fixture.componentInstance.exportCsv();
      lastExportRequest().flush(
        exportResponse({
          players: [zeile({ deactivated_at: '2026-08-01T00:00:00Z' })],
        })
      );

      expect((await csvLines(blobs[0]))[1]).toContain('"Ja"');
    });

    // Eine an der Obergrenze abgeschnittene Datei sieht vollstaendig aus.
    it('sagt es, wenn die Datei an der Obergrenze endet', () => {
      const fixture = setupExport(null);
      lastRequest().flush(
        response({ scope: { mode: 'association', global: true }, total: 60000 })
      );

      fixture.componentInstance.exportCsv();
      lastExportRequest().flush(
        exportResponse({ total: 50000, truncated: true })
      );

      expect(fixture.componentInstance.exportTruncated).toBeTrue();

      // Die Meldung gehoert zur alten Auswahl und muss mit ihr verschwinden.
      fixture.componentInstance.onFilterChange();
      lastRequest().flush(
        response({ scope: { mode: 'association' }, total: 1 })
      );
      expect(fixture.componentInstance.exportTruncated).toBeFalse();
    });

    // Ein gescheiterter Export darf keine leere Datei hinterlassen: Die waere
    // als Arbeitsgrundlage schlimmer als keine.
    it('meldet den Fehler und laedt nichts herunter', () => {
      const fixture = setupExport('113');
      lastRequest().flush(response({ total: 1 }));

      fixture.componentInstance.exportCsv();
      lastExportRequest().flush(
        { error: 'Spielerdaten konnten nicht geladen werden.' },
        { status: 503, statusText: 'Service Unavailable' }
      );

      expect(fixture.componentInstance.exportError).toBe(
        'Spielerdaten konnten nicht geladen werden.'
      );
      expect(fixture.componentInstance.exporting).toBeFalse();
      expect(blobs.length).toBe(0);
      // Die Liste selbst bleibt stehen.
      expect(fixture.componentInstance.loadError).toBeNull();
    });

    // Der Abruf laeuft ueber den ganzen Spielbetrieb; ein zweiter Klick auf den
    // laufenden Export waere eine zweite Aggregatabfrage und eine zweite Datei.
    it('laesst waehrend eines laufenden Exports keinen zweiten zu', () => {
      const fixture = setupExport('113');
      lastRequest().flush(response({ total: 1 }));

      fixture.componentInstance.exportCsv();
      fixture.componentInstance.exportCsv();

      lastExportRequest().flush(exportResponse());
      expect(blobs.length).toBe(1);
    });
  });

  describe('Vorlage', () => {
    function render(clubId: string | null) {
      TestBed.configureTestingModule({
        imports: [
          CommonModule,
          FormsModule,
          HttpClientTestingModule,
          RouterTestingModule,
          UikitCommonModule,
          getTranslocoTestingModule(),
        ],
        declarations: [PlayerStatisticsComponent],
        providers: [
          {
            provide: ActivatedRoute,
            useValue: {
              paramMap: of(convertToParamMap(clubId ? { clubId } : {})),
            },
          },
        ],
      });
      http = TestBed.inject(HttpTestingController);
      const fixture = TestBed.createComponent(PlayerStatisticsComponent);
      fixture.detectChanges();
      return fixture;
    }

    function zellen(fixture: ComponentFixture<PlayerStatisticsComponent>) {
      return Array.from(
        fixture.nativeElement.querySelectorAll('tbody tr:first-child td')
      ).map((td) => (td as HTMLElement).textContent?.trim());
    }

    // Kopf und Zelle stehen in der Vorlage 150 Zeilen auseinander. Vertauscht
    // jemand Tore und Vorlagen, zeigt die Tabelle glaubwuerdige Zahlen unter
    // den falschen Ueberschriften, und nichts wird rot.
    it('stellt die Werte in der Reihenfolge der Spaltenkoepfe', () => {
      const fixture = render('113');
      lastRequest().flush(response({ players: [zeile()], total: 1 }));
      fixture.detectChanges();

      expect(zellen(fixture).slice(0, 9)).toEqual([
        '1',
        'Beispiel, Alex',
        '10',
        '4',
        '3',
        '7',
        '0.70',
        '6',
        '2025/2026 – 2026/2027',
      ]);
    });

    // Die laufende Nummer ist in einer Rangliste die Aussage. Rechnet sie
    // falsch, steht auf Seite 2 eine glaubwuerdige, falsche Reihe.
    it('nummeriert auf Seite 2 ab 51', () => {
      const fixture = render('113');
      lastRequest().flush(response({ players: [zeile()], total: 120 }));
      fixture.detectChanges();

      fixture.componentInstance.changePage(2);
      lastRequest().flush(
        response({
          players: [zeile()],
          page: 2,
          total: 120,
          filters: undefined,
        })
      );
      fixture.detectChanges();

      expect(zellen(fixture)[0]).toBe('51');
    });

    // `(changePage)="changePage(page)"` statt `$event` uebersetzt anstandslos
    // und laesst den Nutzer auf Seite 1 kleben, waehrend die Leiste wechselt.
    it('blaettert ueber die Leiste wirklich weiter', () => {
      const fixture = render('113');
      lastRequest().flush(response({ players: [zeile()], total: 120 }));
      fixture.detectChanges();

      const leiste = fixture.debugElement.query(By.css('fb-pagination'));
      expect(leiste).toBeTruthy();
      leiste.componentInstance.changePage.emit(3);

      const req = lastRequest();
      expect(req.request.params.get('page')).toBe('3');
      req.flush(
        response({
          players: [zeile()],
          page: 3,
          total: 120,
          filters: undefined,
        })
      );
    });

    // Die Vereinsspalte haengt an `isAssociationMode`, und zwar zweimal: am
    // Kopf und an der Zelle. Faellt eine der beiden weg, rutscht die ganze
    // Zeile um eine Spalte.
    it('zeigt die Vereinsspalte nur in der Verbandsansicht', () => {
      const fixture = render(null);
      lastRequest().flush(
        response({
          scope: { mode: 'association', global: false },
          players: [zeile({ home_club_id: 7, home_club: 'SC Beispiel' })],
          total: 1,
          filters: {
            seasons: [{ id: '18', name: '2026/2027' }],
            game_operations: [],
            league_classes: [],
            clubs: [{ id: 7, name: 'SC Beispiel' }],
          },
        })
      );
      fixture.detectChanges();

      const koepfe = Array.from(
        fixture.nativeElement.querySelectorAll('thead th')
      ).map((th) => (th as HTMLElement).textContent?.trim());
      expect(koepfe.length).toBe(11);
      expect(zellen(fixture)[2]).toBe('SC Beispiel');
      expect(zellen(fixture)[3]).toBe('10');
    });

    it('verlinkt den Namen auf die oeffentliche Spielerseite', () => {
      const fixture = render('113');
      lastRequest().flush(response({ players: [zeile()], total: 1 }));
      fixture.detectChanges();

      const link = fixture.nativeElement.querySelector('tbody tr a');
      expect(link.getAttribute('href')).toBe('/spieler/42');
      expect(
        fixture.nativeElement
          .querySelector('[data-testid="edit-link"]')
          .getAttribute('href')
      ).toBe('/verwaltung/vereine/113/spieler/42/bearbeiten');
    });

    // Der Knopf haengt an `total` und nicht an `entries`: Auf der letzten Seite
    // eines grossen Blicks stehen wenige Zeilen, exportiert wird trotzdem alles.
    it('gibt den Export-Knopf erst mit Treffern frei', () => {
      const fixture = render('113');
      const knopf = () =>
        fixture.nativeElement.querySelector(
          '[data-testid="export-csv"]'
        ) as HTMLButtonElement;

      lastRequest().flush(response({ players: [], total: 0 }));
      fixture.detectChanges();
      expect(knopf().disabled).toBeTrue();

      fixture.componentInstance.changePage(2);
      lastRequest().flush(
        response({
          players: [zeile()],
          total: 120,
          page: 2,
          filters: undefined,
        })
      );
      fixture.detectChanges();
      expect(knopf().disabled).toBeFalse();

      spyOn(fixture.componentInstance, 'exportCsv');
      knopf().click();
      expect(fixture.componentInstance.exportCsv).toHaveBeenCalled();
    });

    it('zeigt den Hinweis auf die Obergrenze und den Fehler des Exports', () => {
      const fixture = render('113');
      lastRequest().flush(response({ players: [zeile()], total: 1 }));

      fixture.componentInstance.exportTruncated = true;
      fixture.componentInstance.exportError = 'Kaputt.';
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector('[data-testid="export-truncated"]')
      ).toBeTruthy();
      expect(
        fixture.nativeElement.querySelector('[data-testid="export-error"]')
          .textContent
      ).toContain('Kaputt.');
    });

    // Ein gescheiterter Abruf darf nicht als sauberes Nullergebnis erscheinen.
    it('zeigt den Fehlerkasten statt des Leerzustands', () => {
      const fixture = render('113');
      lastRequest().flush(
        { error: 'Spielerdaten konnten nicht geladen werden.' },
        { status: 503, statusText: 'Service Unavailable' }
      );
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector('[data-testid="load-error"]')
          .textContent
      ).toContain('Spielerdaten konnten nicht geladen werden.');
      expect(
        fixture.nativeElement.querySelector('[data-testid="empty"]')
      ).toBeNull();
      expect(
        fixture.nativeElement.querySelector('[data-testid="retry"]')
      ).toBeTruthy();
    });
  });
});
