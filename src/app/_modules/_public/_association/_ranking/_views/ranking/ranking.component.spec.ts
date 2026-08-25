import { NO_ERRORS_SCHEMA } from '@angular/core';
import {
  ComponentFixture,
  fakeAsync,
  TestBed,
  tick,
} from '@angular/core/testing';

import { RankingComponent } from './ranking.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
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

  getGameScheduleForGameDay() {
    return of([] as GameScheduleEntry[]);
  }
}

describe('RankingComponent', () => {
  let component: RankingComponent;
  let fixture: ComponentFixture<RankingComponent>;
  let leagueService: LeagueServiceStub;

  beforeEach(async () => {
    leagueService = new LeagueServiceStub();

    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [RankingComponent],
      providers: [{ provide: LeagueService, useValue: leagueService }],
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
    // Ohne Guard greift die Komponente auf games[0].game_day zu und reißt mit
    // dem TypeError die ganze Tabellenseite mit.
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
});
