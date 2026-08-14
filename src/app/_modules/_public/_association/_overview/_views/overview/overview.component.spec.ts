import { NO_ERRORS_SCHEMA } from '@angular/core';
import {
  discardPeriodicTasks,
  fakeAsync,
  TestBed,
  tick,
} from '@angular/core/testing';

import { OverviewComponent } from './overview.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AssociationService, LeagueService } from '@floorball/core';
import { GameScheduleEntry, League } from '@floorball/types';
import { BehaviorSubject, of } from 'rxjs';

// Ein Spieltag mit einem Spiel. Mehr liest die Komponente nicht: Sie nimmt die
// Spieltagsnummer aus der ersten Zeile und das Datum für die Bereichsanzeige.
function scheduleFor(gameDay: number): GameScheduleEntry[] {
  return [
    { game_day: gameDay, date: '2026-11-07' },
  ] as unknown as GameScheduleEntry[];
}

function leagueWith(id: number): League {
  return {
    id,
    name: `Liga ${id}`,
    league_type: 'league',
    game_day_titles: [1, 2, 3, 4].map((game_day_number) => ({
      game_day_number,
      title: `${game_day_number}. Spieltag`,
    })),
  } as unknown as League;
}

class LeagueServiceStub {
  selectedLeague$ = new BehaviorSubject<League | null>(null);

  // Der von der API bestimmte Spieltag, den der Erstaufruf liefert.
  currentGameDayCalls = 0;
  requestedGameDays: number[] = [];
  requestedLeagueIds: number[] = [];

  // Spieltage, die es zwar in der Liste gibt, an denen aber nichts angesetzt
  // ist. Die API antwortet dort mit einer leeren Liste, nicht mit einem Fehler.
  emptyGameDays: number[] = [];

  getGameScheduleForCurrentGameDay(leagueId: number) {
    this.currentGameDayCalls += 1;
    this.requestedLeagueIds.push(leagueId);
    return of(scheduleFor(2));
  }

  getGameScheduleForGameDay(leagueId: number, gameDayNumber: number) {
    this.requestedGameDays.push(gameDayNumber);
    this.requestedLeagueIds.push(leagueId);

    return of(
      this.emptyGameDays.includes(gameDayNumber)
        ? []
        : scheduleFor(gameDayNumber)
    );
  }

  getSingleLeague() {
    return of(null);
  }

  getTable() {
    return of([]);
  }

  getScorer() {
    return of([]);
  }
}

class AssociationServiceStub {
  selectedAssociation$ = of(null);

  selectAssociation() {
    // Die Komponente ruft das beim Start auf; für die Spieltagslogik egal.
  }
}

describe('OverviewComponent', () => {
  let leagueService: LeagueServiceStub;

  beforeEach(async () => {
    leagueService = new LeagueServiceStub();

    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [OverviewComponent],
      providers: [
        { provide: LeagueService, useValue: leagueService },
        { provide: AssociationService, useValue: new AssociationServiceStub() },
      ],
      // Die Ansicht besteht fast nur aus fb-Komponenten; hier zählt allein,
      // welchen Spieltag die Komponente nachlädt.
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  // ngOnInit muss über die Änderungserkennung laufen, nicht von Hand: Angular
  // ruft es sonst zusätzlich selbst auf, und die zweite Anmeldung an
  // selectedLeague$ verwirft die Auswahl mitten im Test.
  function startWith(league: League) {
    const fixture = TestBed.createComponent(OverviewComponent);
    fixture.detectChanges();
    leagueService.selectedLeague$.next(league);
    fixture.detectChanges();
    return fixture;
  }

  it('should create', () => {
    const fixture = TestBed.createComponent(OverviewComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  // Kern der Regression: Das 30-Sekunden-Polling fragte immer den aktuellen
  // Spieltag ab und warf damit den gewählten weg.
  it('holt beim Polling den gewählten Spieltag nach, nicht den aktuellen', fakeAsync(() => {
    const league = leagueWith(1);
    const fixture = startWith(league);

    fixture.componentInstance.selectMatchDay(4, league);
    expect(leagueService.requestedGameDays).toEqual([4]);

    tick(30000);

    expect(leagueService.requestedGameDays).toEqual([4, 4]);
    expect(leagueService.currentGameDayCalls).toBe(1);
    expect(leagueService.requestedLeagueIds).toEqual([1, 1, 1]);

    fixture.componentInstance.ngOnDestroy();
    discardPeriodicTasks();
  }));

  // Ein Spieltag ohne Spiele wäre als Auswahl eine Sackgasse: Die Weiter-
  // Zurück-Leiste rechnet mit der Spieltagsnummer der ersten Zeile, die es dort
  // nicht gibt. Das Nachladen muss deshalb wieder beim aktuellen Spieltag
  // landen, statt den leeren festzuhalten.
  it('hält einen Spieltag ohne Spiele nicht fest', fakeAsync(() => {
    leagueService.emptyGameDays = [3];
    const league = leagueWith(1);
    const fixture = startWith(league);

    fixture.componentInstance.selectMatchDay(3, league);
    expect(leagueService.requestedGameDays).toEqual([3]);

    tick(30000);

    expect(leagueService.requestedGameDays).toEqual([3]);
    expect(leagueService.currentGameDayCalls).toBe(2);

    fixture.componentInstance.ngOnDestroy();
    discardPeriodicTasks();
  }));

  // selectedLeague$ meldet dieselbe Liga mehrfach, etwa wenn der Saison-
  // Switcher bei einem Deep-Link in eine alte Saison nachzieht. Das ist kein
  // Ligawechsel und darf die Auswahl nicht verwerfen.
  it('behält die Auswahl, wenn dieselbe Liga erneut gemeldet wird', fakeAsync(() => {
    const league = leagueWith(1);
    const fixture = startWith(league);

    fixture.componentInstance.selectMatchDay(4, league);
    leagueService.selectedLeague$.next(leagueWith(1));

    tick(30000);

    expect(leagueService.requestedGameDays).toEqual([4, 4, 4]);
    expect(leagueService.currentGameDayCalls).toBe(1);

    fixture.componentInstance.ngOnDestroy();
    discardPeriodicTasks();
  }));

  it('bleibt ohne eigene Auswahl beim aktuellen Spieltag', fakeAsync(() => {
    const fixture = startWith(leagueWith(1));

    tick(30000);

    expect(leagueService.currentGameDayCalls).toBe(2);
    expect(leagueService.requestedGameDays).toEqual([]);

    fixture.componentInstance.ngOnDestroy();
    discardPeriodicTasks();
  }));

  // Die Spieltagsnummer der einen Liga meint in der nächsten einen anderen
  // Spieltag, die Auswahl darf den Ligawechsel deshalb nicht überleben.
  it('verwirft die Auswahl beim Wechsel in eine andere Liga', fakeAsync(() => {
    const league = leagueWith(1);
    const fixture = startWith(league);

    fixture.componentInstance.selectMatchDay(4, league);
    leagueService.selectedLeague$.next(leagueWith(2));

    tick(30000);

    expect(leagueService.requestedGameDays).toEqual([4]);
    expect(leagueService.currentGameDayCalls).toBe(3);

    fixture.componentInstance.ngOnDestroy();
    discardPeriodicTasks();
  }));
});
