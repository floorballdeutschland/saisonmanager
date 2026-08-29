import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
  TestRequest,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { getTranslocoTestingModule } from '@floorball/core';
import { environment } from 'src/environments/environment';

import { PlayerStatisticsComponent } from './player-statistics.component';

const URL = `${environment.apiURL}admin/player_statistics.json`;

function response(overrides: Record<string, unknown> = {}) {
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

  function lastRequest(): TestRequest {
    const requests = http.match((req) => req.url === URL);
    return requests[requests.length - 1];
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

    const entry = {
      player_id: 42,
      home_club_id: 999,
    } as never;
    expect(fixture.componentInstance.editClubId(entry)).toBe(113);
  });

  // In der Verbandsansicht steht der Verein je Zeile; ohne ihn (kein laufender
  // Heimatverein) gibt es keinen Pfad in die Pflegemaske.
  it('nimmt in der Verbandsansicht den Heimatverein der Zeile', () => {
    const fixture = setup(null);
    lastRequest().flush(response({ scope: { mode: 'association' } }));

    const component = fixture.componentInstance;
    expect(component.editClubId({ home_club_id: 7 } as never)).toBe(7);
    expect(component.editClubId({ home_club_id: null } as never)).toBeNull();
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

  it('faellt bei unsinniger Mindestzahl auf 1 zurueck', () => {
    const fixture = setup('113');
    lastRequest().flush(response());

    fixture.componentInstance.onMinGamesChange('0');
    expect(fixture.componentInstance.minGames).toBe(1);
    lastRequest().flush(response());
  });

  it('schreibt den Zeitraum aus den Saisonnamen', () => {
    const fixture = setup('113');
    lastRequest().flush(response());

    const component = fixture.componentInstance;
    expect(
      component.period({
        first_season_id: '17',
        last_season_id: '18',
      } as never)
    ).toBe('2025/2026 – 2026/2027');
    expect(
      component.period({
        first_season_id: '17',
        last_season_id: '17',
      } as never)
    ).toBe('2025/2026');
  });
});
