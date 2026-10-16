import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { getTranslocoTestingModule } from '@floorball/core';
import { DetailedStats, Game, Highlights } from '@floorball/types';
import { YoutubeIframeApiService } from '@floorball/core';
import matchDe from '../../../../../../../assets/i18n/match/de.json';
import { MatchHighlightsComponent } from '../match-highlights/match-highlights.component';
import { ShotChartComponent } from '../shot-chart/shot-chart.component';
import { MatchDetailedStatsComponent } from './match-detailed-stats.component';

function game(id: number, overrides: Partial<Game> = {}): Game {
  return {
    id,
    home_team_name: 'Heim',
    guest_team_name: 'Gast',
    ended: true,
    tablet_capture: true,
    period_titles: [],
    ...overrides,
  } as Game;
}

function stats(overrides: Partial<DetailedStats> = {}): DetailedStats {
  const empty = { shots: 0, on_goal: 0, goals: 0, blocked: 0, missed: 0 };
  return {
    complete: true,
    shots: [
      {
        team: 'home',
        period: 1,
        game_time: '01:00',
        x: 0.9,
        y: 0.5,
        result: 'goal',
        shooter: { trikot_number: 10, name: 'A. Schütze' },
      },
      {
        team: 'home',
        period: 2,
        game_time: '22:00',
        x: 0.7,
        y: 0.2,
        result: 'saved',
        shooter: null,
      },
      {
        team: 'guest',
        period: 2,
        game_time: '25:00',
        x: 0.6,
        y: 0.6,
        result: 'missed',
        shooter: null,
      },
    ],
    teams: {
      home: {
        shots: 2,
        on_goal: 2,
        goals: 1,
        blocked: 0,
        missed: 0,
        by_period: {
          '1': { shots: 1, on_goal: 1, goals: 1, blocked: 0, missed: 0 },
          '2': { shots: 1, on_goal: 1, goals: 0, blocked: 0, missed: 0 },
        },
      },
      guest: {
        ...empty,
        shots: 1,
        missed: 1,
        by_period: { '2': { ...empty, shots: 1, missed: 1 } },
      },
    },
    goalkeepers: [
      {
        team: 'guest',
        trikot_number: 1,
        name: 'G. Halter',
        saves: 1,
        shots_against: 2,
        save_pct: 0.5,
      },
    ],
    players: [
      {
        team: 'home',
        trikot_number: 10,
        name: 'A. Schütze',
        shots: 1,
        on_goal: 1,
        goals: 1,
      },
    ],
    ...overrides,
  };
}

describe('MatchDetailedStatsComponent', () => {
  let fixture: ComponentFixture<MatchDetailedStatsComponent>;
  let component: MatchDetailedStatsComponent;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const statsUrl = (id: number) => (r: { url: string }) =>
    r.url.endsWith(`games/${id}/detailed_stats.json`);
  const highlightsUrl = (id: number) => (r: { url: string }) =>
    r.url.endsWith(`games/${id}/highlights.json`);
  // Statistik und Szenen kommen zusammen an; ohne Antwort für die Szenen
  // bliebe auch die Statistik offen.
  const noHighlights = (id: number) =>
    http
      .expectOne(highlightsUrl(id))
      .flush('kein Tablet-Spiel', { status: 404, statusText: 'Not Found' });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        getTranslocoTestingModule({ de: { match: matchDe } }),
      ],
      declarations: [
        MatchDetailedStatsComponent,
        ShotChartComponent,
        MatchHighlightsComponent,
      ],
      providers: [
        {
          provide: YoutubeIframeApiService,
          useValue: jasmine.createSpyObj('YoutubeIframeApiService', [
            'createPlayer',
          ]),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MatchDetailedStatsComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function load(
    data: DetailedStats,
    id = 1,
    highlights: Highlights | null = null
  ) {
    fixture.componentRef.setInput('game', game(id));
    fixture.detectChanges();
    http.expectOne(statsUrl(id)).flush(data);
    if (highlights) {
      http.expectOne(highlightsUrl(id)).flush(highlights);
    } else {
      noHighlights(id);
    }
    fixture.detectChanges();
  }

  it('lädt die Statistik des Spiels und zeigt beide Schussgrafiken', () => {
    load(stats());

    expect(el().querySelector('[data-test="chart-home"]')).toBeTruthy();
    expect(el().querySelector('[data-test="chart-guest"]')).toBeTruthy();
    expect(
      el().querySelectorAll('[data-test="chart-home"] circle[data-result]')
        .length
    ).toBe(2);
    expect(el().textContent).toContain('G. Halter');
    expect(el().textContent).toContain('A. Schütze');
  });

  describe('Hinweis auf unvollständige Erfassung', () => {
    it('fehlt, wenn die Schüsse als vollständig bestätigt sind', () => {
      load(stats({ complete: true }));
      expect(el().querySelector('[data-test="stats-incomplete"]')).toBeNull();
    });

    it('erscheint bei complete = false', () => {
      load(stats({ complete: false }));
      expect(
        el().querySelector('[data-test="stats-incomplete"]')?.textContent
      ).toContain(matchDe.detailedStats.incomplete);
    });

    it('erscheint auch, wenn die Frage nicht beantwortet ist (null)', () => {
      load(stats({ complete: null }));
      expect(el().querySelector('[data-test="stats-incomplete"]')).toBeTruthy();
    });
  });

  it('filtert die Schussgrafik nach Abschnitt', () => {
    load(stats());
    const buttons = el().querySelectorAll<HTMLButtonElement>(
      '[data-test="period-filter"]'
    );
    // Alle, 1, 2
    expect(buttons.length).toBe(3);

    buttons[2].click();
    fixture.detectChanges();

    expect(component.selectedPeriod).toBe(2);
    expect(
      el().querySelectorAll('[data-test="chart-home"] circle[data-result]')
        .length
    ).toBe(1);
    expect(
      el()
        .querySelector('[data-test="chart-home"] circle[data-result]')
        ?.getAttribute('data-result')
    ).toBe('saved');
  });

  it('listet je Team eine Gesamtzeile und eine Zeile je Abschnitt', () => {
    load(stats());
    const rows = el().querySelectorAll('[data-test="shots-home"] tbody tr');
    expect(rows.length).toBe(3);
    expect(rows[0].textContent).toContain('Gesamt');
  });

  it('zeigt die Fangquote aus Paraden und Schüssen aufs Tor', () => {
    load(stats());
    expect(
      el().querySelector('[data-test="save-pct"]')?.textContent?.trim()
    ).toMatch(/^50[.,]0 %$/);
  });

  it('blendet Spieler- und Torhüterbereich ohne Daten aus', () => {
    load(stats({ players: [], goalkeepers: [] }));
    expect(el().querySelector('[data-test="players"]')).toBeNull();
    expect(el().querySelector('[data-test="goalkeepers"]')).toBeNull();
  });

  it('meldet einen gescheiterten ersten Abruf im Reiter', () => {
    fixture.componentRef.setInput('game', game(1));
    fixture.detectChanges();
    http
      .expectOne(statsUrl(1))
      .flush('nicht da', { status: 404, statusText: 'Not Found' });
    noHighlights(1);
    fixture.detectChanges();
    expect(el().querySelector('[data-test="stats-failed"]')).toBeTruthy();
  });

  describe('Spielwechsel', () => {
    it('lädt beim neuen Spiel neu und verwirft die Antwort für das alte', () => {
      fixture.componentRef.setInput('game', game(1));
      fixture.detectChanges();
      const alt = http.expectOne(statsUrl(1));
      const altHighlights = http.expectOne(highlightsUrl(1));

      fixture.componentRef.setInput('game', game(2));

      fixture.detectChanges();
      const neu = http.expectOne(statsUrl(2));

      // switchMap hat den alten Abruf abgebrochen.
      expect(alt.cancelled).toBeTrue();
      expect(altHighlights.cancelled).toBeTrue();
      neu.flush(stats({ complete: false }));
      noHighlights(2);
      fixture.detectChanges();

      expect(component.stats?.complete).toBeFalse();
    });

    it('setzt Abschnittsfilter und alten Stand beim Wechsel sofort zurück', () => {
      load(stats());
      component.selectPeriod(2);

      fixture.componentRef.setInput('game', game(2));

      fixture.detectChanges();
      expect(component.stats).toBeUndefined();
      expect(component.selectedPeriod).toBeNull();
      http.expectOne(statsUrl(2)).flush(stats());
      noHighlights(2);
    });

    it('lädt dasselbe Spiel mit neuem Stand still nach und behält den Filter', () => {
      load(stats());
      component.selectPeriod(1);

      fixture.componentRef.setInput('game', game(1, { result_string: '3:0' }));

      fixture.detectChanges();
      const req = http.expectOne(statsUrl(1));
      req.flush('weg', { status: 500, statusText: 'Server Error' });
      http
        .expectOne(highlightsUrl(1))
        .flush('weg', { status: 500, statusText: 'Server Error' });

      expect(component.stats).toBeDefined();
      expect(component.failed).toBeFalse();
      expect(component.selectedPeriod).toBe(1);
    });
  });

  // fe#555: Torszenen nur mit Video und mindestens einer Szene.
  describe('Torszenen', () => {
    const highlights = (overrides: Partial<Highlights> = {}): Highlights => ({
      video_id: 'abc123',
      scenes: [
        {
          event_id: 11,
          start: 100,
          end: 120,
          team: 'home',
          home_goals: 1,
          guest_goals: 0,
          period: 1,
          game_time: '01:10',
          scorer: { trikot_number: 10, name: 'A. Schütze' },
          assist: null,
        },
      ],
      ...overrides,
    });
    const goalPoint = () =>
      el().querySelector<SVGCircleElement>(
        '[data-test="chart-home"] circle[data-result="goal"]'
      );

    it('zeigt den Szenen-Player und macht das Tor in der Schussgrafik anklickbar', () => {
      load(stats(), 1, highlights());

      expect(el().querySelector('fb-match-highlights')).toBeTruthy();
      expect(goalPoint()?.getAttribute('role')).toBe('button');
      expect(el().querySelector('[data-test="jump-hint"]')).toBeTruthy();
    });

    it('bleibt ohne Video unsichtbar, auch wenn es Szenen gibt', () => {
      load(stats(), 1, highlights({ video_id: null }));

      expect(el().querySelector('fb-match-highlights')).toBeNull();
      expect(goalPoint()?.getAttribute('role')).toBeNull();
      expect(el().querySelector('[data-test="jump-hint"]')).toBeNull();
    });

    it('bleibt ohne Szene unsichtbar', () => {
      load(stats(), 1, highlights({ scenes: [] }));
      expect(el().querySelector('fb-match-highlights')).toBeNull();
    });

    it('bleibt bei 404 unsichtbar, die Statistik erscheint trotzdem', () => {
      load(stats());
      expect(el().querySelector('fb-match-highlights')).toBeNull();
      expect(el().querySelector('[data-test="chart-home"]')).toBeTruthy();
    });

    it('springt beim Klick auf ein Tor zur passenden Szene', () => {
      load(stats(), 1, highlights());
      const jump = spyOn(component.highlightsPlayer!, 'jumpTo');

      goalPoint()?.dispatchEvent(new MouseEvent('click'));

      expect(jump).toHaveBeenCalledWith(0);
    });

    it('verschwindet still, wenn YouTube das Video ablehnt', () => {
      load(stats(), 1, highlights());

      component.onHighlightsUnavailable();
      fixture.detectChanges();

      expect(el().querySelector('fb-match-highlights')).toBeNull();
      expect(goalPoint()?.getAttribute('role')).toBeNull();
    });
  });
});
