import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { NavigationEnd, NavigationError, Router } from '@angular/router';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { AppComponent } from './app.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import {
  LeagueService,
  NotificationService,
  SessionService,
  SystemHealthService,
  SystemHealthSummary,
} from '@floorball/core';
import { User } from '@floorball/types';

describe('AppComponent', () => {
  // SessionService wird gestubbt: sein echter TranslocoService-Abhängigkeitsbaum
  // ist im TestBed nicht bereitgestellt (NG0201 TRANSLOCO_TRANSPILER). Der Stub
  // liefert nur die im Bauteil genutzten isLoggedIn$ und currentUser$.
  let isLoggedIn$: BehaviorSubject<boolean>;
  let currentUser$: BehaviorSubject<User | null>;
  let systemHealth: jasmine.SpyObj<SystemHealthService>;

  // Nur die Rechte, die AppComponent liest. `as unknown as User` statt eines
  // vollen Nutzerobjekts: alles andere ist für den Streifen belanglos.
  const userWith = (permissions: Record<string, boolean>) =>
    ({ permissions }) as unknown as User;

  beforeEach(async () => {
    isLoggedIn$ = new BehaviorSubject<boolean>(false);
    currentUser$ = new BehaviorSubject<User | null>(null);
    systemHealth = jasmine.createSpyObj('SystemHealthService', ['getSummary']);
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [AppComponent],
      providers: [
        { provide: SessionService, useValue: { isLoggedIn$, currentUser$ } },
        { provide: SystemHealthService, useValue: systemHealth },
      ],
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

  describe('Hinweisstreifen Speicherplatz', () => {
    const summary = (
      overrides: Partial<SystemHealthSummary> = {}
    ): SystemHealthSummary => ({
      status: 'critical',
      used_percent: 93,
      free_bytes: 1024,
      ...overrides,
    });

    function percentAfterInit(): number | null | undefined {
      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges(); // ngOnInit

      let seen: number | null | undefined;
      fixture.componentInstance.criticalDiskPercent$.subscribe(
        (v) => (seen = v)
      );
      return seen;
    }

    it('fragt ohne das Recht nichts ab', () => {
      currentUser$.next(userWith({ menu_item_league_admin: true }));

      expect(percentAfterInit()).toBeNull();
      expect(systemHealth.getSummary).not.toHaveBeenCalled();
    });

    it('zeigt den Streifen erst im kritischen Zustand', () => {
      currentUser$.next(userWith({ menu_item_system_health: true }));
      systemHealth.getSummary.and.returnValue(
        of(summary({ status: 'warning', used_percent: 85 }))
      );

      expect(percentAfterInit()).toBeNull();
    });

    it('nennt im kritischen Zustand die Belegung', () => {
      currentUser$.next(userWith({ menu_item_system_health: true }));
      systemHealth.getSummary.and.returnValue(of(summary()));

      expect(percentAfterInit()).toBe(93);
    });

    // Der Streifen ist ein Zusatz. Ein gescheiterter Abruf darf keine Meldung
    // ueber jede Seite legen.
    it('bleibt bei einem gescheiterten Abruf still', () => {
      currentUser$.next(userWith({ menu_item_system_health: true }));
      systemHealth.getSummary.and.returnValue(
        throwError(() => new Error('503'))
      );

      expect(percentAfterInit()).toBeNull();
    });
  });
});
