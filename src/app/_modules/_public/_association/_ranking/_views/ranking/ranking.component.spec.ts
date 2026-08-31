import { NO_ERRORS_SCHEMA } from '@angular/core';
import {
  ComponentFixture,
  fakeAsync,
  TestBed,
  tick,
} from '@angular/core/testing';

import { RankingComponent } from './ranking.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { LeagueService } from '@floorball/core';
import { GameScheduleEntry, League, TableEntry } from '@floorball/types';
import { BehaviorSubject, config, of } from 'rxjs';

function leagueWith(gameDayTitles: number[]): League {
  return {
    id: 1791,
    name: 'Hessenliga U15',
    game_day_titles: gameDayTitles.map((game_day_number) => ({
      game_day_number,
      title: `${game_day_number}. Spieltag`,
    })),
  } as unknown as League;
}

class LeagueServiceStub {
  selectedLeague$ = new BehaviorSubject<League | null>(null);

  // Was die API für den aktuellen Spieltag liefert. Eine Liga ohne angesetzte
  // Spiele antwortet mit einer leeren Liste, nicht mit einem Fehler.
  currentGameDaySchedule: GameScheduleEntry[] = [];

  getTable() {
    return of([] as TableEntry[]);
  }

  getGameScheduleForCurrentGameDay() {
    return of(this.currentGameDaySchedule);
  }

  // Der ausdruecklich angeforderte Spieltag: gemerkt fuer die Pruefung, und mit
  // eigenem Spielplan, damit sich die Antwort von der des aktuellen
  // unterscheidet.
  requestedGameDays: number[] = [];
  requestedGameDaySchedule: GameScheduleEntry[] = [];

  getGameScheduleForGameDay(_leagueId: number, gameDayNumber: number) {
    this.requestedGameDays.push(gameDayNumber);
    return of(this.requestedGameDaySchedule);
  }
}

describe('RankingComponent', () => {
  let component: RankingComponent;
  let fixture: ComponentFixture<RankingComponent>;
  let leagueService: LeagueServiceStub;
  let route: {
    snapshot: { queryParamMap: ReturnType<typeof convertToParamMap> };
  };

  function withQueryParams(values: Record<string, string>) {
    route.snapshot.queryParamMap = convertToParamMap(values);
  }

  beforeEach(async () => {
    leagueService = new LeagueServiceStub();
    route = { snapshot: { queryParamMap: convertToParamMap({}) } };

    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [RankingComponent],
      providers: [
        { provide: LeagueService, useValue: leagueService },
        { provide: ActivatedRoute, useValue: route },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RankingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('wählt den Spieltag der ersten Zeile aus', () => {
    leagueService.currentGameDaySchedule = [
      { game_day: 3 },
    ] as unknown as GameScheduleEntry[];

    leagueService.selectedLeague$.next(leagueWith([1, 2, 3, 4]));

    expect(component.selectedMatchDay?.game_day_number).toBe(3);
  });

  // Der Zugriff steckt in einem tap. Ein Fehler dort landet nicht beim
  // Aufrufer, sondern im Fehlerkanal des Streams, und RxJS meldet ihn erst
  // danach über onUnhandledError. Ohne dieses Abfangen wäre der Test blind.
  function unhandledErrorsWhile(action: () => void): unknown[] {
    const collected: unknown[] = [];
    const original = config.onUnhandledError;
    config.onUnhandledError = (error) => collected.push(error);

    try {
      action();
      tick();
    } finally {
      config.onUnhandledError = original;
    }

    return collected;
  }

  it('überlebt eine Liga ohne angesetzte Spiele', fakeAsync(() => {
    // Ohne Guard greift die Komponente auf games[0].game_day zu. Der TypeError
    // landet im Fehlerkanal des tap und damit über onUnhandledError in Sentry
    // (2R, 47 Ereignisse); die Seite rendert weiter, aber die Spieltagsauswahl
    // bleibt stehen, wo sie war.
    leagueService.currentGameDaySchedule = [];

    const errors = unhandledErrorsWhile(() =>
      leagueService.selectedLeague$.next(leagueWith([1, 2]))
    );

    expect(errors).toEqual([]);
    expect(component.selectedMatchDay?.game_day_number).toBe(1);
  }));

  it('überlebt eine Liga ganz ohne Spieltage', fakeAsync(() => {
    leagueService.currentGameDaySchedule = [];

    const errors = unhandledErrorsWhile(() =>
      leagueService.selectedLeague$.next(leagueWith([]))
    );

    expect(errors).toEqual([]);
    expect(component.selectedMatchDay).toBeNull();
  }));
  // ---------------------------------------------------------------------------
  // Der gewaehlte Spieltag steht in der Adresse
  // ---------------------------------------------------------------------------

  // Dieselbe Luecke wie in der Uebersicht: Tabelle und Einzelspiel sind
  // Geschwister am selben Outlet. Ohne den Parameter lud die Rueckkehr aus einem
  // Spiel wieder den von der API bestimmten Spieltag, und die Auswahl im
  // Spielbegegnungen-Feld war weg.
  it('laedt den Spieltag aus der Adresse statt des aktuellen', () => {
    withQueryParams({ spieltag: '3' });
    leagueService.requestedGameDaySchedule = [
      { game_day: 3 },
    ] as unknown as GameScheduleEntry[];

    leagueService.selectedLeague$.next(leagueWith([1, 2, 3, 4]));

    expect(leagueService.requestedGameDays).toEqual([3]);
    expect(component.selectedMatchDay?.game_day_number).toBe(3);
  });

  it('faellt ohne brauchbare Nummer auf den aktuellen Spieltag zurueck', () => {
    withQueryParams({ spieltag: '0' });
    leagueService.currentGameDaySchedule = [
      { game_day: 2 },
    ] as unknown as GameScheduleEntry[];

    leagueService.selectedLeague$.next(leagueWith([1, 2, 3]));

    expect(leagueService.requestedGameDays).toEqual([]);
    expect(component.selectedMatchDay?.game_day_number).toBe(2);
  });

  it('schreibt die Auswahl aus dem Feld in die Adresse', () => {
    const navigate = spyOn(TestBed.inject(Router), 'navigate');
    const league = leagueWith([1, 2, 3, 4]);
    leagueService.selectedLeague$.next(league);

    component.selectMatchDay(4, league);

    expect(navigate).toHaveBeenCalledWith([], {
      relativeTo: route as unknown as ActivatedRoute,
      queryParams: { spieltag: 4 },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  });
});
