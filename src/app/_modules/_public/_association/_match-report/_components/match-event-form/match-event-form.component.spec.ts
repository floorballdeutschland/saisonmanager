import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MatchEventFormComponent } from './match-event-form.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import {
  formatSecondsAsGameTime,
  getPeriodMaxSeconds,
  isEventTimeValid,
} from './event-time-validation';
import {
  Game,
  GameAdditionalFields,
  GameEvent,
  League,
} from '@floorball/types';

// 3 Perioden à 20 Minuten, 10 Minuten Verlängerung
const leagueSettings = {
  periods: 3,
  period_length: 20,
  overtime_length: 10,
} as League;

describe('event-time-validation', () => {
  describe('getPeriodMaxSeconds', () => {
    it('should return the period length for every regular period', () => {
      // Die Uhr startet in jedem Abschnitt neu bei 0:00, die Obergrenze ist
      // deshalb in jedem Abschnitt dieselbe.
      expect(getPeriodMaxSeconds(leagueSettings, 1)).toBe(20 * 60);
      expect(getPeriodMaxSeconds(leagueSettings, 2)).toBe(20 * 60);
      expect(getPeriodMaxSeconds(leagueSettings, 3)).toBe(20 * 60);
    });

    it('should bound overtime (periods + 1) by overtime_length', () => {
      expect(getPeriodMaxSeconds(leagueSettings, 4)).toBe(10 * 60);
    });

    it('should not constrain overtime when overtime_length is missing', () => {
      expect(
        getPeriodMaxSeconds({ ...leagueSettings, overtime_length: 0 }, 4)
      ).toBeNull();
    });

    it('should not constrain penalty shooting (periods + 2)', () => {
      expect(getPeriodMaxSeconds(leagueSettings, 5)).toBeNull();
    });

    it('should not constrain when league settings are missing or invalid', () => {
      expect(getPeriodMaxSeconds(null, 2)).toBeNull();
      expect(getPeriodMaxSeconds(undefined, 2)).toBeNull();
      expect(
        getPeriodMaxSeconds({ ...leagueSettings, period_length: 0 }, 2)
      ).toBeNull();
      expect(getPeriodMaxSeconds(leagueSettings, NaN)).toBeNull();
      expect(getPeriodMaxSeconds(leagueSettings, 0)).toBeNull();
      // Pausen tragen in League#period_titles gebrochene Perioden (1.5, 2.5 …).
      expect(getPeriodMaxSeconds(leagueSettings, 1.5)).toBeNull();
    });

    it('should handle two-halves leagues', () => {
      const halves = { periods: 2, period_length: 25, overtime_length: 10 };
      expect(getPeriodMaxSeconds(halves, 2)).toBe(25 * 60);
      expect(getPeriodMaxSeconds(halves, 3)).toBe(10 * 60);
    });
  });

  describe('isEventTimeValid', () => {
    const period2 = getPeriodMaxSeconds(leagueSettings, 2);

    it('should accept times within the period', () => {
      expect(isEventTimeValid(period2, 0, 12)).toBeTrue();
      expect(isEventTimeValid(period2, 1, 30)).toBeTrue();
      expect(isEventTimeValid(period2, 19, 59)).toBeTrue();
    });

    it('should accept the period boundary (inclusive)', () => {
      expect(isEventTimeValid(period2, 20, 0)).toBeTrue();
    });

    it('should reject times beyond the period length', () => {
      expect(isEventTimeValid(period2, 20, 1)).toBeFalse();
      expect(isEventTimeValid(period2, 25, 0)).toBeFalse();
      expect(isEventTimeValid(period2, 45, 0)).toBeFalse();
    });

    it('should reject implausible values regardless of the limit', () => {
      expect(isEventTimeValid(null, 1, 75)).toBeFalse();
      expect(isEventTimeValid(null, -1, 0)).toBeFalse();
      expect(isEventTimeValid(period2, 1, -1)).toBeFalse();
    });

    it('should accept any plausible time without a limit', () => {
      expect(isEventTimeValid(null, 95, 30)).toBeTrue();
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

    it('should flag times beyond the period length and disable submit', () => {
      component.minutes = 45;
      component.seconds = 0;

      expect(component.timeOutOfRange()).toBeTrue();
      expect(component.submitDisabled()).toBeTrue();
      // Zusammenhängend prüfen: "0:00" allein wäre auch Teilstring von "20:00".
      expect(component.timeRangeErrorText()).toContain(
        'erlaubt: 0:00 bis 20:00'
      );
    });

    it('should accept the clock reading of the selected period', () => {
      // Die Uhr läuft im 2. Drittel wieder von 0:00 bis 20:00.
      component.minutes = 1;
      component.seconds = 30;

      expect(component.timeOutOfRange()).toBeFalse();
      expect(component.submitDisabled()).toBeFalse();
    });

    it('should accept the period boundaries', () => {
      component.minutes = 0;
      component.seconds = 0;
      expect(component.timeOutOfRange()).toBeFalse();

      component.minutes = 20;
      component.seconds = 0;
      expect(component.timeOutOfRange()).toBeFalse();

      component.minutes = 20;
      component.seconds = 1;
      expect(component.timeOutOfRange()).toBeTrue();
    });

    it('should reject seconds greater than 59', () => {
      component.minutes = 1;
      component.seconds = 75;

      expect(component.timeOutOfRange()).toBeTrue();
      expect(component.submitDisabled()).toBeTrue();
    });

    it('should validate overtime against overtime_length', () => {
      component.currentPeriod = '4';

      component.minutes = 9;
      component.seconds = 0;
      expect(component.timeOutOfRange()).toBeFalse();

      component.minutes = 11;
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

    it('should keep an existing event with a deviating time editable', () => {
      // Einzelne Zeitnehmer tragen die kumulierte Spielzeit ein (0,8 % der
      // Ereignisse in der 1. FBL). Solche Bestandsereignisse müssen weiter
      // bearbeitbar bleiben, sonst ließe sich an ihnen auch keine
      // Trikotnummer mehr korrigieren.
      // number: ngOnInit übernimmt die Trikotnummer aus dem Ereignis.
      component.existingEvent = {
        period: 2,
        time: '32:12',
        number: 7,
      } as GameEvent;
      component.ngOnInit();
      component.league = leagueSettings;

      expect(component.timeOutOfRange()).toBeTrue();
      expect(component.timeBlocksSubmit()).toBeFalse();
      expect(component.submitDisabled()).toBeFalse();
    });

    it('should block an existing event once its time is changed', () => {
      // number: ngOnInit übernimmt die Trikotnummer aus dem Ereignis.
      component.existingEvent = {
        period: 2,
        time: '32:12',
        number: 7,
      } as GameEvent;
      component.ngOnInit();
      component.league = leagueSettings;

      component.minutes = 33;

      expect(component.timeBlocksSubmit()).toBeTrue();
      expect(component.submitDisabled()).toBeTrue();
    });

    it('should block an existing event once its period is changed', () => {
      component.existingEvent = {
        period: 2,
        time: '32:12',
        number: 7,
      } as GameEvent;
      component.ngOnInit();
      component.league = leagueSettings;

      component.changePeriod({ target: { value: '3' } } as unknown as Event);

      expect(component.timeBlocksSubmit()).toBeTrue();
      expect(component.submitDisabled()).toBeTrue();
    });

    it('should block a penalty-shootout event moved into a regular period', () => {
      // Im Penalty-Schießen steht per Konvention die kumulierte Zeit (70:00),
      // dort gibt es keine Obergrenze. Wird der Abschnitt nachträglich auf ein
      // Drittel umgestellt, muss die Zeit periodenrelativ nachgezogen werden.
      component.currentPeriod = '5';
      component.existingEvent = {
        period: 5,
        time: '70:00',
        number: 7,
      } as GameEvent;
      component.ngOnInit();
      component.league = leagueSettings;

      expect(component.timeOutOfRange()).toBeFalse();

      component.changePeriod({ target: { value: '2' } } as unknown as Event);

      expect(component.timeOutOfRange()).toBeTrue();
      expect(component.timeBlocksSubmit()).toBeTrue();
      expect(component.submitDisabled()).toBeTrue();
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
  describe('coachNumbers', () => {
    // Strafen gegen Betreuer laufen über die Pseudo-Trikotnummern 2001–2005.
    // Angeboten wird nur, wer im Spielbericht namentlich eingetragen ist.
    const withCoaches = (
      home: Partial<GameAdditionalFields['home_team_coaches']>,
      guest: Partial<GameAdditionalFields['guest_team_coaches']> = {}
    ) =>
      ({
        home_team_coaches: home,
        guest_team_coaches: guest,
      }) as GameAdditionalFields;

    it('should offer only coaches with a name, in order', () => {
      component.team = 'home';
      component.additionalFields = withCoaches({
        coach1_last_name: 'Meier',
        coach3_first_name: 'Anna',
      });

      expect(component.coachNumbers()).toEqual([1, 3]);
    });

    it('should read the coaches of the selected team', () => {
      component.team = 'guest';
      component.additionalFields = withCoaches(
        { coach1_last_name: 'Meier' },
        { coach2_last_name: 'Schulz' }
      );

      expect(component.coachNumbers()).toEqual([2]);
    });

    it('should offer nothing without additionalFields', () => {
      component.team = 'home';
      component.additionalFields = undefined;

      expect(component.coachNumbers()).toEqual([]);
    });

    it('should offer nothing when no coach has a name', () => {
      component.team = 'home';
      component.additionalFields = withCoaches({ coach1_last_name: '' });

      expect(component.coachNumbers()).toEqual([]);
    });

    // Die Nummer lässt sich auch von Hand ins Nr.-Feld tippen; das Dropdown ist
    // dann umgangen und muss dieselbe Bedingung prüfen.
    it('should accept a hand-typed number for a named coach', () => {
      component.team = 'home';
      component.additionalFields = withCoaches({ coach2_last_name: 'Meier' });

      component.searchPlayerByNumber('home', 2002, false);

      expect(component.playerNumber).toBe(2002);
      expect(component.playerError).toBeFalse();
    });

    it('should reject a hand-typed number for an empty coach slot', () => {
      component.team = 'home';
      component.additionalFields = withCoaches({ coach1_last_name: 'Meier' });

      component.searchPlayerByNumber('home', 2003, false);

      // Sonst entstünde eine Strafe gegen einen Betreuer ohne Namen: in der
      // Ereignisliste bliebe die Zeile namenlos und der Strafgrund unsichtbar.
      expect(component.playerNumber).toBe(0);
      expect(component.playerError).toBeTrue();
    });

    it('should not treat a coach number as an assist', () => {
      component.team = 'home';
      component.additionalFields = withCoaches({ coach1_last_name: 'Meier' });
      component.match = {
        players: { home: [], guest: [] },
      } as unknown as Game;

      component.searchPlayerByNumber('home', 2001, true);

      expect(component.assistPlayerNumber).toBe(0);
      expect(component.assistError).toBeTrue();
    });

    it('should restore a stored coach penalty for editing', () => {
      component.type = 'penalty';
      component.team = 'home';
      component.additionalFields = withCoaches({ coach1_last_name: 'Meier' });
      component.match = {
        league_id: 1,
        players: { home: [], guest: [] },
        referees: [],
      } as unknown as Game;
      component.existingEvent = {
        event_type: 'penalty',
        number: 2001,
        time: '5:30',
        period: 1,
        penalty_id: 7,
        penalty_code_id: 12,
      } as GameEvent;

      component.ngOnInit();

      expect(component.playerNumber).toBe(2001);
      expect(component.coachNumbers()).toEqual([1]);
    });
  });
});
