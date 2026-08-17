import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { By } from '@angular/platform-browser';
import { BehaviorSubject, Subject, of } from 'rxjs';

import { TournamentMatchesComponent } from './tournament-matches.component';
import { LeagueService } from '@floorball/core';
import { GameScheduleEntry, League } from '@floorball/types';

describe('TournamentMatchesComponent', () => {
  let component: TournamentMatchesComponent;
  let fixture: ComponentFixture<TournamentMatchesComponent>;
  let selectedLeague$: BehaviorSubject<League | null>;
  let schedule: Record<number, GameScheduleEntry[]>;
  let getGameSchedule: jasmine.Spy;

  const league = (id: number) => ({ id }) as League;
  const entry = (partial: Partial<GameScheduleEntry>) =>
    partial as GameScheduleEntry;

  const groupGame = (started: boolean) =>
    entry({ group_identifier: 'a', started });
  const finalGame = (started: boolean) =>
    entry({ group_identifier: null, series_title: 'Halbfinale', started });

  beforeEach(async () => {
    selectedLeague$ = new BehaviorSubject<League | null>(null);
    schedule = {};
    getGameSchedule = jasmine
      .createSpy('getGameSchedule')
      .and.callFake((id: number) => of(schedule[id] ?? []));

    await TestBed.configureTestingModule({
      // Die beiden Kindkomponenten sind hier nicht deklariert; ohne dieses
      // Schema scheitert das Rendern an ihren Eingaben.
      schemas: [NO_ERRORS_SCHEMA],
      declarations: [TournamentMatchesComponent],
      providers: [
        {
          provide: LeagueService,
          useValue: { selectedLeague$, getGameSchedule },
        },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TournamentMatchesComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('öffnet die Gruppenphase, solange kein Platzierungsspiel angepfiffen ist', () => {
    schedule[7] = [groupGame(true), finalGame(false)];
    selectedLeague$.next(league(7));

    fixture.detectChanges();

    expect(component.round).toBe(0);
  });

  it('öffnet die Platzierungsspiele, sobald eines davon läuft', () => {
    schedule[7] = [groupGame(true), finalGame(true)];
    selectedLeague$.next(league(7));

    fixture.detectChanges();

    expect(component.round).toBe(1);
  });

  it('zählt auch ein bereits beendetes Platzierungsspiel', () => {
    schedule[7] = [
      entry({ group_identifier: null, started: true, ended: true }),
    ];
    selectedLeague$.next(league(7));

    fixture.detectChanges();

    expect(component.round).toBe(1);
  });

  // Bewusst über den Klick im Template und nicht über selectRound(): Sonst
  // bliebe die Verdrahtung des Knopfes ungeprüft, und ein Rückbau auf
  // `round = r` fiele nicht auf, obwohl er genau diese Sperre aushebelt.
  it('behält die von Hand gewählte Ansicht, wenn dieselbe Liga erneut lädt', () => {
    schedule[7] = [groupGame(true), finalGame(true)];
    component.selectedLeague = league(7);
    selectedLeague$.next(league(7));
    fixture.detectChanges();
    expect(component.round).toBe(1);

    const groupTab = fixture.debugElement.queryAll(By.css('button'))[0];
    groupTab.nativeElement.click();
    fixture.detectChanges();
    expect(component.round).toBe(0);

    selectedLeague$.next(league(7));
    fixture.detectChanges();

    expect(component.round).toBe(0);
  });

  it('verwirft die verspätete Antwort der zuvor gezeigten Liga', () => {
    const slow = new Subject<GameScheduleEntry[]>();
    getGameSchedule.and.callFake((id: number) =>
      id === 7 ? slow.asObservable() : of(schedule[id] ?? [])
    );
    schedule[8] = [groupGame(true), finalGame(false)];

    // detectChanges zuerst: Erst dadurch laeuft ngOnInit und die Komponente
    // haengt an selectedLeague$. Vorher gesendete Ligen erreichten sie nicht,
    // der BehaviorSubject reichte nur die letzte nach.
    fixture.detectChanges();
    selectedLeague$.next(league(7));
    selectedLeague$.next(league(8));
    fixture.detectChanges();
    expect(component.round).toBe(0);

    // Liga 7 antwortet erst jetzt, angezeigt wird längst Liga 8.
    slow.next([finalGame(true)]);
    fixture.detectChanges();

    expect(component.round).toBe(0);
  });

  it('wählt bei einem Ligawechsel wieder selbst aus', () => {
    schedule[7] = [finalGame(true)];
    schedule[8] = [groupGame(true), finalGame(false)];

    selectedLeague$.next(league(7));
    fixture.detectChanges();
    component.selectRound(1);

    selectedLeague$.next(league(8));
    fixture.detectChanges();

    expect(component.round).toBe(0);
  });
});
