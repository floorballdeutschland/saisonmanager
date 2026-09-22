import {
  discardPeriodicTasks,
  fakeAsync,
  TestBed,
  tick,
} from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { LeagueService } from '@floorball/core';
import { GameScheduleEntry, League } from '@floorball/types';
import {
  BehaviorSubject,
  Observable,
  of,
  Subscription,
  throwError,
} from 'rxjs';

import { LeagueHostComponent } from './league-host.component';

describe('LeagueHostComponent', () => {
  let leagueService: jasmine.SpyObj<LeagueService>;

  beforeEach(async () => {
    leagueService = jasmine.createSpyObj<LeagueService>(
      'LeagueService',
      ['getGameScheduleForCurrentGameDay', 'clearLeague', 'selectLeague'],
      // Die Ströme, die ngOnInit liest. createSpyObj legt nur Methoden an, ohne
      // sie stünde dort `undefined.pipe`.
      { selectedLeague$: new BehaviorSubject<League | null>(null) }
    );
    leagueService.getGameScheduleForCurrentGameDay.and.returnValue(
      of([] as GameScheduleEntry[])
    );

    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [LeagueHostComponent],
      providers: [{ provide: LeagueService, useValue: leagueService }],
    }).compileComponents();
  });

  function startPolling(): {
    component: LeagueHostComponent;
    subscription: Subscription;
  } {
    const component =
      TestBed.createComponent(LeagueHostComponent).componentInstance;
    component.getMatches(7);

    // Der Strom laeuft erst, wenn ihn jemand abonniert. Im Betrieb macht das
    // die async-Pipe der Vorlage.
    const subscription = (
      component.matches$ as Observable<GameScheduleEntry[] | null>
    ).subscribe({ next: () => undefined, error: () => undefined });

    return { component, subscription };
  }

  it('should create', () => {
    const fixture = TestBed.createComponent(LeagueHostComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  // fe#489: Die erste Emission des Timers kommt nach 1 ms, ist also der Aufruf
  // der Seite. Nur die Takte danach sind Hintergrund und duerfen schweigen.
  it('laedt den ersten Abruf laut und die Takte still nach', fakeAsync(() => {
    const { component, subscription } = startPolling();

    tick(1);
    expect(leagueService.getGameScheduleForCurrentGameDay).toHaveBeenCalledWith(
      7,
      false
    );

    tick(30000);
    expect(leagueService.getGameScheduleForCurrentGameDay).toHaveBeenCalledWith(
      7,
      true
    );

    subscription.unsubscribe();
    component.ngOnDestroy();
    discardPeriodicTasks();
  }));

  // `retry()` ohne Wartezeit baute den Strom sofort neu auf, und weil
  // timer(1, 30000) dabei wieder bei 1 ms anfaengt, fragte die Ansicht bei
  // gestoerter Verbindung im Dauerlauf nach.
  it('wartet nach einem Fehler einen ganzen Takt, statt sofort erneut zu fragen', fakeAsync(() => {
    leagueService.getGameScheduleForCurrentGameDay.and.returnValue(
      throwError(() => new Error('kaputt'))
    );

    const { component, subscription } = startPolling();

    tick(1);
    expect(
      leagueService.getGameScheduleForCurrentGameDay
    ).toHaveBeenCalledTimes(1);

    tick(29999);
    expect(
      leagueService.getGameScheduleForCurrentGameDay
    ).toHaveBeenCalledTimes(1);

    // Zwei Millisekunden, weil die Wartezeit beim Fehler startet (t = 1) und
    // der neu aufgebaute timer(1, 30000) noch eine Millisekunde braucht.
    tick(2);
    expect(
      leagueService.getGameScheduleForCurrentGameDay
    ).toHaveBeenCalledTimes(2);

    subscription.unsubscribe();
    component.ngOnDestroy();
    discardPeriodicTasks();
  }));
});
