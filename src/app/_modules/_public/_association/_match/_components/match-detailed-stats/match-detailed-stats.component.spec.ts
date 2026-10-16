import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { getTranslocoTestingModule } from '@floorball/core';
import { DetailedStats, Game } from '@floorball/types';
import matchDe from '../../../../../../../assets/i18n/match/de.json';
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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        getTranslocoTestingModule({ de: { match: matchDe } }),
      ],
      declarations: [MatchDetailedStatsComponent, ShotChartComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MatchDetailedStatsComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function load(data: DetailedStats, id = 1) {
    fixture.componentRef.setInput('game', game(id));
    fixture.detectChanges();
    http.expectOne(statsUrl(id)).flush(data);
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
    fixture.detectChanges();
    expect(el().querySelector('[data-test="stats-failed"]')).toBeTruthy();
  });

  describe('Spielwechsel', () => {
    it('lädt beim neuen Spiel neu und verwirft die Antwort für das alte', () => {
      fixture.componentRef.setInput('game', game(1));
      fixture.detectChanges();
      const alt = http.expectOne(statsUrl(1));

      fixture.componentRef.setInput('game', game(2));

      fixture.detectChanges();
      const neu = http.expectOne(statsUrl(2));

      // switchMap hat den alten Abruf abgebrochen.
      expect(alt.cancelled).toBeTrue();
      neu.flush(stats({ complete: false }));
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
    });

    it('lädt dasselbe Spiel mit neuem Stand still nach und behält den Filter', () => {
      load(stats());
      component.selectPeriod(1);

      fixture.componentRef.setInput('game', game(1, { result_string: '3:0' }));

      fixture.detectChanges();
      const req = http.expectOne(statsUrl(1));
      req.flush('weg', { status: 500, statusText: 'Server Error' });

      expect(component.stats).toBeDefined();
      expect(component.failed).toBeFalse();
      expect(component.selectedPeriod).toBe(1);
    });
  });
});
