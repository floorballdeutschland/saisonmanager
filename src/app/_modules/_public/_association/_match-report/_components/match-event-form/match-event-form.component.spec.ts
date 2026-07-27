import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MatchEventFormComponent } from './match-event-form.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import {
  formatSecondsAsGameTime,
  getPeriodTimeRange,
  isEventTimeInRange,
} from './event-time-validation';
import { Game, GameEvent, League } from '@floorball/types';

// 3 Perioden à 20 Minuten, 10 Minuten Verlängerung
const leagueSettings = {
  periods: 3,
  period_length: 20,
  overtime_length: 10,
} as League;

describe('event-time-validation', () => {
  describe('getPeriodTimeRange', () => {
    it('should return cumulative bounds for a regular period', () => {
      expect(getPeriodTimeRange(leagueSettings, 1)).toEqual({
        startSeconds: 0,
        endSeconds: 20 * 60,
      });
      expect(getPeriodTimeRange(leagueSettings, 2)).toEqual({
        startSeconds: 20 * 60,
        endSeconds: 40 * 60,
      });
      expect(getPeriodTimeRange(leagueSettings, 3)).toEqual({
        startSeconds: 40 * 60,
        endSeconds: 60 * 60,
      });
    });

    it('should bound overtime (periods + 1) by overtime_length', () => {
      expect(getPeriodTimeRange(leagueSettings, 4)).toEqual({
        startSeconds: 60 * 60,
        endSeconds: 70 * 60,
      });
    });

    it('should not constrain overtime when overtime_length is missing', () => {
      expect(
        getPeriodTimeRange({ ...leagueSettings, overtime_length: 0 }, 4)
      ).toBeNull();
    });

    it('should not constrain penalty shooting (periods + 2)', () => {
      expect(getPeriodTimeRange(leagueSettings, 5)).toBeNull();
    });

    it('should not constrain when league settings are missing or invalid', () => {
      expect(getPeriodTimeRange(null, 2)).toBeNull();
      expect(getPeriodTimeRange(undefined, 2)).toBeNull();
      expect(
        getPeriodTimeRange({ ...leagueSettings, period_length: 0 }, 2)
      ).toBeNull();
      expect(getPeriodTimeRange(leagueSettings, NaN)).toBeNull();
      expect(getPeriodTimeRange(leagueSettings, 0)).toBeNull();
    });

    it('should handle two-halves leagues', () => {
      const halves = { periods: 2, period_length: 25, overtime_length: 10 };
      expect(getPeriodTimeRange(halves, 2)).toEqual({
        startSeconds: 25 * 60,
        endSeconds: 50 * 60,
      });
      expect(getPeriodTimeRange(halves, 3)).toEqual({
        startSeconds: 50 * 60,
        endSeconds: 60 * 60,
      });
    });
  });

  describe('isEventTimeInRange', () => {
    const period2 = getPeriodTimeRange(leagueSettings, 2);

    it('should accept times within the period', () => {
      expect(isEventTimeInRange(period2, 21, 30)).toBeTrue();
      expect(isEventTimeInRange(period2, 39, 59)).toBeTrue();
    });

    it('should accept the period boundaries (inclusive)', () => {
      expect(isEventTimeInRange(period2, 20, 0)).toBeTrue();
      expect(isEventTimeInRange(period2, 40, 0)).toBeTrue();
    });

    it('should reject times outside the period', () => {
      expect(isEventTimeInRange(period2, 19, 59)).toBeFalse();
      expect(isEventTimeInRange(period2, 40, 1)).toBeFalse();
      expect(isEventTimeInRange(period2, 45, 0)).toBeFalse();
    });

    it('should reject implausible values regardless of range', () => {
      expect(isEventTimeInRange(null, 21, 75)).toBeFalse();
      expect(isEventTimeInRange(null, -1, 0)).toBeFalse();
      expect(isEventTimeInRange(period2, 21, -1)).toBeFalse();
    });

    it('should accept any plausible time without a range', () => {
      expect(isEventTimeInRange(null, 95, 30)).toBeTrue();
    });
  });

  describe('formatSecondsAsGameTime', () => {
    it('should format seconds as game time', () => {
      expect(formatSecondsAsGameTime(0)).toBe('0:00');
      expect(formatSecondsAsGameTime(1200)).toBe('20:00');
      expect(formatSecondsAsGameTime(3661)).toBe('61:01');
    });
  });
});

describe('MatchEventFormComponent', () => {
  let component: MatchEventFormComponent;
  let fixture: ComponentFixture<MatchEventFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [MatchEventFormComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MatchEventFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('time validation for goal events', () => {
    beforeEach(() => {
      component.type = 'goal';
      component.match = { league_id: 1 } as Game;
      component.league = leagueSettings;
      component.currentPeriod = '2';
      component.minutesValid = true;
      component.secondsValid = true;
      component.playerNumber = 7;
    });

    it('should flag times outside the selected period and disable submit', () => {
      component.minutes = 45;
      component.seconds = 0;

      expect(component.timeOutOfRange()).toBeTrue();
      expect(component.submitDisabled()).toBeTrue();
      expect(component.timeRangeErrorText()).toContain('20:00');
      expect(component.timeRangeErrorText()).toContain('40:00');
    });

    it('should accept times inside the selected period', () => {
      component.minutes = 21;
      component.seconds = 30;

      expect(component.timeOutOfRange()).toBeFalse();
      expect(component.submitDisabled()).toBeFalse();
    });

    it('should accept the period boundaries', () => {
      component.minutes = 20;
      component.seconds = 0;
      expect(component.timeOutOfRange()).toBeFalse();

      component.minutes = 40;
      component.seconds = 0;
      expect(component.timeOutOfRange()).toBeFalse();
    });

    it('should reject seconds greater than 59', () => {
      component.minutes = 21;
      component.seconds = 75;

      expect(component.timeOutOfRange()).toBeTrue();
      expect(component.submitDisabled()).toBeTrue();
    });

    it('should validate overtime against overtime_length', () => {
      component.currentPeriod = '4';

      component.minutes = 65;
      component.seconds = 0;
      expect(component.timeOutOfRange()).toBeFalse();

      component.minutes = 71;
      component.seconds = 0;
      expect(component.timeOutOfRange()).toBeTrue();
    });

    it('should not constrain penalty shooting', () => {
      component.currentPeriod = '5';
      component.minutes = 70;
      component.seconds = 0;

      expect(component.timeOutOfRange()).toBeFalse();
    });

    it('should not validate while the league is not loaded (fail open)', () => {
      component.league = null;
      component.minutes = 95;
      component.seconds = 0;

      expect(component.timeOutOfRange()).toBeFalse();
      expect(component.submitDisabled()).toBeFalse();
    });

    it('should fall back to the period of an existing event', () => {
      component.currentPeriod = '';
      component.existingEvent = { period: 1 } as GameEvent;
      component.minutes = 25;
      component.seconds = 0;

      expect(component.timeOutOfRange()).toBeTrue();

      component.minutes = 15;
      expect(component.timeOutOfRange()).toBeFalse();
    });
  });

  describe('period progression', () => {
    // Abschnittskette einer Drittel-Liga (vgl. League#period_titles): nur die
    // Verlängerungs-/Penalty-Kette ist als optional markiert.
    const periodTitles = [
      {
        period: 1,
        short_title: '1',
        title: '1. Drittel',
        status_id: 'period1',
        running: true,
        can_end_game: false,
        optional: false,
      },
      {
        period: 1.5,
        short_title: 'P1',
        title: '1. Drittelpause',
        status_id: 'pause1',
        running: false,
        can_end_game: false,
        optional: false,
      },
      {
        period: 3,
        short_title: '3',
        title: '3. Drittel',
        status_id: 'period3',
        running: true,
        can_end_game: true,
        optional: false,
      },
      {
        period: 3.5,
        short_title: 'PV',
        title: 'Pause vor Verlängerung',
        status_id: 'pause_et',
        running: false,
        can_end_game: false,
        optional: true,
      },
      {
        period: 4,
        short_title: 'V',
        title: 'Verlängerung',
        status_id: 'extratime',
        running: true,
        can_end_game: true,
        optional: true,
      },
      {
        period: 5,
        short_title: 'P',
        title: 'Penalty-Schießen',
        status_id: 'penalty_shots',
        running: true,
        can_end_game: true,
        optional: true,
      },
    ];

    function setGame(
      ingame_status: string | null,
      home_goals = 0,
      guest_goals = 0
    ) {
      component.match = {
        id: 1,
        league_id: 1,
        ingame_status,
        period_titles: periodTitles,
        result: { home_goals, guest_goals },
      } as unknown as Game;
    }

    describe('nextPeriodTitle', () => {
      it('should return the first period before kick-off', () => {
        // Der Spielstart setzt den ingame_status aus dieser Rückgabe – ohne
        // Treffer bliebe das gestartete Spiel ohne Spielabschnitt.
        setGame(null);
        expect(component.nextPeriodTitle()?.status_id).toBe('period1');
      });

      it('should return the following period of the chain', () => {
        setGame('period1');
        expect(component.nextPeriodTitle()?.status_id).toBe('pause1');
      });

      it('should return null after the last period', () => {
        setGame('penalty_shots');
        expect(component.nextPeriodTitle()).toBeNull();
      });
    });

    describe('advanceAllowed', () => {
      it('should block the break before overtime when a team leads', () => {
        setGame('period3', 1, 0);
        expect(component.advanceAllowed()).toBeFalse();
      });

      it('should allow the break before overtime on a level score', () => {
        setGame('period3', 1, 1);
        expect(component.advanceAllowed()).toBeTrue();
      });

      it('should block overtime itself when a team leads', () => {
        setGame('pause_et', 2, 1);
        expect(component.advanceAllowed()).toBeFalse();
      });

      it('should block penalty shooting when a team leads', () => {
        setGame('extratime', 2, 1);
        expect(component.advanceAllowed()).toBeFalse();
      });

      it('should allow regular periods regardless of the score', () => {
        setGame('period1', 3, 0);
        expect(component.advanceAllowed()).toBeTrue();
      });
    });

    describe('selectablePeriods', () => {
      it('should not offer penalty shooting for timeouts', () => {
        component.type = 'timeout';
        setGame('period3');
        const ids = component
          .selectablePeriods()
          .map((period) => period.status_id);

        expect(ids).toContain('period1');
        expect(ids).not.toContain('penalty_shots');
      });

      it('should offer every running period for other events', () => {
        component.type = 'goal';
        setGame('period3');
        const ids = component
          .selectablePeriods()
          .map((period) => period.status_id);

        expect(ids).toContain('penalty_shots');
        expect(ids).not.toContain('pause1');
      });
    });
  });
});
