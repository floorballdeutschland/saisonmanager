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
import { FreeHitChartComponent } from '../free-hit-chart/free-hit-chart.component';
import { RinkMarkingsComponent } from '../rink-markings/rink-markings.component';
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
        event_id: 11,
      },
      {
        team: 'home',
        period: 2,
        game_time: '22:00',
        x: 0.7,
        y: 0.2,
        result: 'saved',
        shooter: null,
        event_id: null,
      },
      {
        team: 'guest',
        period: 2,
        game_time: '25:00',
        x: 0.6,
        y: 0.6,
        result: 'missed',
        shooter: null,
        event_id: null,
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
        FreeHitChartComponent,
        RinkMarkingsComponent,
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

  describe('Feldgröße (fe#591)', () => {
    const svg = () =>
      el().querySelector('[data-test="chart-home"] svg') as SVGSVGElement;
    const goalDot = () =>
      el().querySelector(
        '[data-test="chart-home"] circle[data-result="goal"]'
      ) as SVGCircleElement;

    it('zeichnet ohne Feldgröße das Großfeld 40 x 20 m', () => {
      load(stats());
      expect(svg().getAttribute('data-field-size')).toBe('GF');
      expect(svg().getAttribute('viewBox')).toBe('-0.5 -0.5 41 21');
      // x = 0,9 vor dem gegnerischen Tor, auf 40 m
      expect(Number(goalDot().getAttribute('cx'))).toBeCloseTo(36, 5);
      expect(Number(goalDot().getAttribute('cy'))).toBeCloseTo(10, 5);
    });

    it('zeichnet ein Kleinfeld-Spiel auf 28 x 16 m', () => {
      fixture.componentRef.setInput('fieldSize', 'KF');
      load(stats());
      expect(svg().getAttribute('data-field-size')).toBe('KF');
      expect(svg().getAttribute('viewBox')).toBe('-0.5 -0.5 29 17');
      expect(Number(goalDot().getAttribute('cx'))).toBeCloseTo(25.2, 5);
      expect(Number(goalDot().getAttribute('cy'))).toBeCloseTo(8, 5);
      // Mittelpunkt statt Mittelkreis, Torräume beidseitig
      const center = el().querySelector(
        '[data-test="chart-home"] [data-testid="field-center"]'
      );
      expect(center?.getAttribute('cx')).toBe('14');
      expect(
        el().querySelectorAll(
          '[data-test="chart-home"] [data-testid="field-goal-area"]'
        ).length
      ).toBe(2);
    });
  });

  describe('Freischläge (fe#589)', () => {
    const withFreeHits = () => {
      const data = stats({
        free_hits: [
          { team: 'home', period: 1, game_time: '02:00', x: 0.2, y: 0.5 },
          { team: 'home', period: 2, game_time: '21:00', x: 0.8, y: 0.5 },
          { team: 'guest', period: 2, game_time: '23:00', x: 0.6, y: 0.1 },
        ],
      });
      data.teams.home.free_hits = 2;
      data.teams.home.shots_from_free_hit = 1;
      data.teams.home.goals_from_free_hit = 1;
      data.teams.home.by_period['2'].free_hits = 1;
      return data;
    };

    it('fehlt ohne erfasste Freischläge', () => {
      load(stats());
      expect(el().querySelector('[data-test="free-hits"]')).toBeNull();
    });

    it('zeigt Freischläge getrennt vom Schussbild mit Zonen und Summen', () => {
      load(withFreeHits());

      expect(
        el().querySelectorAll('[data-test="free-hits-home"] polygon').length
      ).toBe(2);
      // Das Schussbild zeigt weiter nur die Schüsse.
      expect(
        el().querySelectorAll('[data-test="chart-home"] circle[data-result]')
          .length
      ).toBe(2);
      expect(
        el().querySelector('[data-test="free-hit-zones-home"]')?.textContent
      ).toMatch(
        /Eigene Hälfte:\s*1.*Gegnerische Hälfte:\s*0.*Nähe Torraum:\s*1/s
      );

      const total = el().querySelector(
        '[data-test="free-hit-table-home"] tbody tr'
      ) as HTMLTableRowElement;
      const cells = Array.from(total.cells).map((c) => c.textContent?.trim());
      expect(cells.slice(1)).toEqual(['2', '1', '1']);
    });

    it('filtert die Freischläge mit dem Abschnittsfilter', () => {
      load(withFreeHits());
      component.selectPeriod(2);
      fixture.detectChanges();
      expect(
        el().querySelectorAll('[data-test="free-hits-home"] polygon').length
      ).toBe(1);
    });

    it('rechnet die Zonen auf dem Kleinfeld in dessen Metern', () => {
      fixture.componentRef.setInput('fieldSize', 'KF');
      load(
        stats({
          free_hits: [
            { team: 'home', period: 1, game_time: '02:00', x: 0.65, y: 0.5 },
          ],
        })
      );
      expect(
        el()
          .querySelector('[data-test="free-hits-home"] polygon')
          ?.getAttribute('data-zone')
      ).toBe('near_goal_area');
      expect(
        el()
          .querySelector('[data-test="free-hits-home"] svg')
          ?.getAttribute('data-field-size')
      ).toBe('KF');
    });
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
      // Unter role="img" wären die Tor-Schaltflächen für Screenreader weg.
      expect(
        el().querySelector('[data-test="chart-home"] svg')?.getAttribute('role')
      ).toBe('group');
      expect(el().querySelector('[data-test="jump-hint"]')).toBeTruthy();
    });

    it('bleibt ohne Video unsichtbar, auch wenn es Szenen gibt', () => {
      load(stats(), 1, highlights({ video_id: null }));

      expect(el().querySelector('fb-match-highlights')).toBeNull();
      expect(goalPoint()?.getAttribute('role')).toBeNull();
      expect(el().querySelector('[data-test="jump-hint"]')).toBeNull();
      expect(
        el().querySelector('[data-test="chart-home"] svg')?.getAttribute('role')
      ).toBe('img');
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

  it('nennt im Tooltip der Schussgrafik den Abschnittstitel des Spiels', () => {
    fixture.componentRef.setInput(
      'game',
      game(1, {
        period_titles: [{ period: 1, title: '1. Drittel' }],
      } as Partial<Game>)
    );
    fixture.detectChanges();
    http.expectOne(statsUrl(1)).flush(stats());
    noHighlights(1);
    fixture.detectChanges();

    const titles = Array.from(
      el().querySelectorAll('[data-test="chart-home"] circle title')
    ).map((t) => t.textContent ?? '');
    expect(titles.some((t) => t.includes('1. Drittel'))).toBeTrue();
    // Ohne Titel im Spiel: „2. Abschnitt“ aus der Übersetzung
    expect(titles.some((t) => t.includes('2. Abschnitt'))).toBeTrue();
  });

  // Schüsse ändern das Spiel nicht; der Takt ist die einzige Nachladequelle
  // während des Spiels, ein geändertes Spiel lädt dann nicht zusätzlich.
  it('lädt ein laufendes Spiel im Takt nach, nicht bei jeder Spieländerung', () => {
    fixture.componentRef.setInput('game', game(1, { ended: false }));
    fixture.detectChanges();
    http.expectOne(statsUrl(1)).flush(stats());
    noHighlights(1);

    fixture.componentRef.setInput(
      'game',
      game(1, { ended: false, result_string: '1:0' })
    );
    fixture.detectChanges();
    http.expectNone(statsUrl(1));
    http.expectNone(highlightsUrl(1));

    component.onRefreshTick();
    http.expectOne(statsUrl(1)).flush(stats());
    noHighlights(1);
  });

  it('lädt ein beendetes Spiel im Takt nicht mehr nach', () => {
    load(stats());
    component.onRefreshTick();
    http.expectNone(statsUrl(1));
    http.expectNone(highlightsUrl(1));
  });

  describe('Strafschüsse, Torwartsituation, Paraden ohne Position (Feedback #61 bis #64)', () => {
    const empty = { shots: 0, on_goal: 0, goals: 0, blocked: 0, missed: 0 };

    function special(): DetailedStats {
      const base = stats();
      return stats({
        shots: [
          { ...base.shots[0], from_penalty_shot: true },
          { ...base.shots[1], x: null, y: null },
          { ...base.shots[2], empty_net: true, result: 'goal' },
        ],
        teams: {
          home: {
            ...base.teams.home,
            penalty_shots: 1,
            goals_from_penalty_shot: 1,
            goals_empty_net: 0,
            goals_extra_attacker: 0,
          },
          guest: {
            ...base.teams.guest,
            goals_empty_net: 1,
            by_period: {
              '2': { ...empty, shots: 1, goals: 1, goals_empty_net: 1 },
            },
          },
        },
        goalkeepers: [
          {
            ...base.goalkeepers[0],
            by_period: {
              '1': { saves: 0, shots_against: 1, save_pct: 0 },
              '2': { saves: 1, shots_against: 1, save_pct: 1 },
            },
          },
        ],
      });
    }

    it('lässt Paraden ohne Position aus der Grafik, nennt sie aber darunter', () => {
      load(special());

      expect(
        el().querySelectorAll('[data-test="chart-home"] circle[data-result]')
          .length
      ).toBe(1);
      expect(
        el().querySelector('[data-test="unplaced-home"]')?.textContent
      ).toContain('1 Parade(n) ohne Position');
      expect(el().querySelector('[data-test="unplaced-guest"]')).toBeNull();
    });

    it('kennzeichnet Strafschüsse in der Grafik und in der Legende', () => {
      load(special());

      expect(
        el().querySelectorAll(
          '[data-test="chart-home"] circle[data-penalty-shot]'
        ).length
      ).toBe(1);
      expect(el().querySelector('[data-test="legend-penalty"]')).toBeTruthy();
      const title =
        el().querySelector('[data-test="chart-home"] circle[data-result] title')
          ?.textContent ?? '';
      expect(title).toContain('(Strafschuss)');
    });

    it('zählt Strafschüsse und Tore ins leere Tor je Team und Abschnitt', () => {
      load(special());

      const home = el().querySelectorAll(
        '[data-test="situation-table-home"] tbody tr'
      );
      expect(home[0].textContent?.replace(/\s+/g, ' ')).toContain(
        'Gesamt 1 1 0 0'
      );
      const guest = el().querySelectorAll(
        '[data-test="situation-table-guest"] tbody tr'
      );
      expect(guest[0].textContent?.replace(/\s+/g, ' ')).toContain(
        'Gesamt 0 0 1 0'
      );
    });

    it('fehlt ohne Strafschüsse und ohne Tore bei herausgenommenem Torhüter', () => {
      load(stats());
      expect(el().querySelector('[data-test="special-situations"]')).toBeNull();
      expect(el().querySelector('[data-test="legend-penalty"]')).toBeNull();
    });

    it('zeigt die Paraden des Torhüters je Abschnitt', () => {
      load(special());

      const cells = Array.from(
        el().querySelectorAll('[data-test="goalkeeper-period"]')
      ).map((cell) => cell.textContent?.trim());
      expect(cells).toEqual(['0/1', '1/1']);
      expect(
        el().querySelectorAll('[data-test="goalkeeper-period-head"]').length
      ).toBe(2);
    });

    it('zeigt nach einem Torhüterwechsel „–“ für Abschnitte ohne Einsatz', () => {
      const data = special();
      data.goalkeepers = [
        {
          team: 'guest',
          trikot_number: 1,
          name: 'G. Halter',
          saves: 1,
          shots_against: 2,
          save_pct: 0.5,
          by_period: {
            '1': { saves: 1, shots_against: 2, save_pct: 0.5 },
            '2': { saves: 0, shots_against: 0, save_pct: null },
          },
        },
        {
          team: 'guest',
          trikot_number: 30,
          name: 'E. Wechsel',
          saves: 2,
          shots_against: 2,
          save_pct: 1,
          by_period: {
            '1': { saves: 0, shots_against: 0, save_pct: null },
            '2': { saves: 2, shots_against: 2, save_pct: 1 },
          },
        },
      ];
      load(data);

      const cells = Array.from(
        el().querySelectorAll('[data-test="goalkeeper-period"]')
      ).map((cell) => cell.textContent?.trim());
      expect(cells).toEqual(['1/2', '–', '–', '2/2']);
    });

    it('zeigt ohne Aufteilung der API keine Abschnittsspalten beim Torhüter', () => {
      load(stats());
      expect(el().querySelector('[data-test="goalkeeper-period"]')).toBeNull();
    });
  });
});
