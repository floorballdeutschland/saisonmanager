import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, of, throwError } from 'rxjs';

import { PlayerMergeComponent } from './player-merge.component';
import {
  getTranslocoTestingModule,
  NotificationService,
  PlayerService,
  SessionService,
} from '@floorball/core';
import { Player, User } from '@floorball/models';

// Die Maske holt den Master über denselben Profilabruf wie die
// Spielerbearbeitung (`admin/players/:id.json`). Seit der beim 403 vom Rauswurf
// des ErrorInterceptors ausgenommen ist, meldet der ihn nicht mehr – ohne einen
// eigenen Zweig sprang diese Maske also wortlos auf die Suche zurück, und der
// Klick auf „Duplikat zusammenführen" sah aus, als täte er nichts.
//
// Der Fall ist erreichbar: `player_merge` hat auch die auf einen Spielbetrieb
// begrenzte SBK, während `merge` den Zugriff auf das Profil verlangt.
describe('PlayerMergeComponent', () => {
  let currentUser$: BehaviorSubject<User | null>;
  let getPlayer: jasmine.Spy;

  async function setup(user: Partial<User>) {
    currentUser$ = new BehaviorSubject<User | null>(user as User);
    getPlayer = jasmine.createSpy('getPlayer');

    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        FormsModule,
        getTranslocoTestingModule(),
      ],
      declarations: [PlayerMergeComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: new Map([['id', '7']]) } },
        },
        { provide: SessionService, useValue: { currentUser$ } },
        { provide: PlayerService, useValue: { getPlayer } },
      ],
    }).compileComponents();

    return TestBed.createComponent(PlayerMergeComponent);
  }

  const berechtigt = { permissions: { player_merge: true } } as Partial<User>;

  it('meldet die fehlende Zuständigkeit und kehrt zur Suche zurück', async () => {
    const fixture = await setup(berechtigt);
    const notify = spyOn(TestBed.inject(NotificationService), 'error');
    const navigate = spyOn(TestBed.inject(Router), 'navigate');
    getPlayer.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 403 }))
    );

    fixture.detectChanges();

    expect(notify).toHaveBeenCalled();
    // Die Meldung muss den Routenwechsel überleben, sonst räumt die Suche sie
    // im selben Moment wieder ab.
    expect(notify.calls.mostRecent().args[1]).toEqual(
      jasmine.objectContaining({ keepAfterRouteChange: true })
    );
    expect(navigate).toHaveBeenCalledWith([
      '/',
      'verwaltung',
      'spieler',
      'suche',
    ]);
  });

  // Für jeden anderen Fehlschlag hat der Interceptor weiterhin einen eigenen
  // Zweig; eine zweite Meldung wäre eine doppelte.
  it('meldet einen anderen Fehler nicht selbst', async () => {
    const fixture = await setup(berechtigt);
    const notify = spyOn(TestBed.inject(NotificationService), 'error');
    const navigate = spyOn(TestBed.inject(Router), 'navigate');
    getPlayer.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 500 }))
    );

    fixture.detectChanges();

    expect(notify).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalled();
  });

  it('lädt den Master, wenn der Zugriff besteht', async () => {
    const fixture = await setup(berechtigt);
    getPlayer.and.returnValue(of({ id: 7 } as Player));

    fixture.detectChanges();

    expect(fixture.componentInstance.master?.id).toBe(7);
  });
});
