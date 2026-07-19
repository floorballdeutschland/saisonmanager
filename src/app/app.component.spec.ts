import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { NavigationEnd, NavigationError, Router } from '@angular/router';
import { BehaviorSubject, Subject } from 'rxjs';
import { AppComponent } from './app.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import {
  LeagueService,
  NotificationService,
  SessionService,
} from '@floorball/core';

describe('AppComponent', () => {
  // SessionService wird gestubbt: sein echter TranslocoService-Abhängigkeitsbaum
  // ist im TestBed nicht bereitgestellt (NG0201 TRANSLOCO_TRANSPILER). Der Stub
  // liefert nur das im Bauteil genutzte isLoggedIn$.
  let isLoggedIn$: BehaviorSubject<boolean>;

  beforeEach(async () => {
    isLoggedIn$ = new BehaviorSubject<boolean>(false);
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [AppComponent],
      providers: [{ provide: SessionService, useValue: { isLoggedIn$ } }],
    })
      .overrideTemplate(AppComponent, '')
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  // Regressionsschutz zu #103: Der Sidebar-Switcher muss über changeSeason
  // gehen, nicht direkt über AssociationService.selectSeason.
  it('onSeasonChange delegiert an LeagueService.changeSeason', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const changeSeason = spyOn(TestBed.inject(LeagueService), 'changeSeason');

    fixture.componentInstance.onSeasonChange(12);

    expect(changeSeason).toHaveBeenCalledWith(12);
  });

  describe('isHome$ (Spielbetriebe-Seitenmenü)', () => {
    let events$: Subject<unknown>;

    beforeEach(() => {
      events$ = new Subject<unknown>();
      TestBed.overrideProvider(Router, {
        useValue: { events: events$.asObservable(), url: '/' },
      });
    });

    it('ist true auf der Startseite für nicht eingeloggte Besucher', () => {
      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges(); // ngOnInit

      const seen: boolean[] = [];
      fixture.componentInstance.isHome$.subscribe((v) => seen.push(v));

      expect(seen.at(-1)).toBe(true);
    });

    it('ist false auf der Startseite, sobald der Nutzer eingeloggt ist', () => {
      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();

      const seen: boolean[] = [];
      fixture.componentInstance.isHome$.subscribe((v) => seen.push(v));

      isLoggedIn$.next(true);

      expect(seen.at(-1)).toBe(false);
    });

    it('ist false abseits der Startseite, auch nicht eingeloggt', () => {
      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();

      const seen: boolean[] = [];
      fixture.componentInstance.isHome$.subscribe((v) => seen.push(v));

      events$.next(new NavigationEnd(1, '/login', '/login'));

      expect(seen.at(-1)).toBe(false);
    });
  });

  describe('Lazy-Load-Fehler', () => {
    let events$: Subject<unknown>;
    let errorSpy: jasmine.Spy;

    beforeEach(() => {
      events$ = new Subject<unknown>();
      TestBed.overrideProvider(Router, {
        useValue: { events: events$.asObservable(), url: '/' },
      });
      errorSpy = spyOn(TestBed.inject(NotificationService), 'error');
      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges(); // ngOnInit
    });

    it('zeigt bei fehlgeschlagenem Modul-Nachladen eine Fehlermeldung', () => {
      events$.next(
        new NavigationError(
          1,
          '/verwaltung/ligen',
          new TypeError(
            'Failed to fetch dynamically imported module: https://example.org/chunk-x.js'
          )
        )
      );

      expect(errorSpy).toHaveBeenCalledWith(
        jasmine.stringContaining('konnte nicht geladen werden'),
        // Kein keepAfterRouteChange: die Meldung entsteht nach dem
        // NavigationStart-Cleanup und soll die nächste Navigation NICHT
        // überleben (sonst bleibt sie auf der intakten Zielseite stehen).
        { autoClose: false }
      );
    });

    it('meldet andere NavigationErrors nicht', () => {
      events$.next(
        new NavigationError(
          1,
          '/gibt-es-nicht',
          new Error("Cannot match any routes. URL Segment: 'gibt-es-nicht'")
        )
      );

      expect(errorSpy).not.toHaveBeenCalled();
    });
  });
});
