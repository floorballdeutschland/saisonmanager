import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';

import { MatchEventFormComponent } from './match-event-form.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import {
  formatSecondsAsGameTime,
  getPeriodMaxSeconds,
  isEventTimeValid,
} from './event-time-validation';
import { personName, splitPersonName } from './person-name';
import {
  Game,
  GameAdditionalFields,
  GameEvent,
  League,
} from '@floorball/types';
import { GameService, NotificationService } from '@floorball/core';
import { SortTrikotnumbersPipe } from 'src/app/_helpers/_pipes';
import { FormsModule } from '@angular/forms';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError, config as rxjsConfig } from 'rxjs';

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

describe('personName', () => {
  it('setzt Nachname und Vorname mit dem Trennzeichen zusammen', () => {
    expect(personName('Ziegler', 'Carolina')).toBe('Ziegler, Carolina');
  });

  // Der eigentliche Fund vom 15.08.: Ein Template-Literal machte aus dem
  // fehlenden Nachnamen die Zeichenkette 'undefined', die so im Spielbericht
  // stand (79 bzw. 85 Eintraege auf Prod).
  it('schreibt kein "undefined", wenn ein Teil fehlt', () => {
    expect(personName(undefined, 'Carolina')).toBe(', Carolina');
    expect(personName('Ziegler', undefined)).toBe('Ziegler');
  });

  // 1408 bzw. 1346 Spiele trugen ein Leerzeichen am Ende, weil die Eingabe
  // ungetrimmt uebernommen wurde.
  it('trimmt beide Teile', () => {
    expect(personName(' Ziegler ', ' Carolina ')).toBe('Ziegler, Carolina');
  });

  it('leert das Feld, statt ", " zu speichern', () => {
    expect(personName('', '')).toBe('');
    expect(personName(undefined, undefined)).toBe('');
    expect(personName('  ', '  ')).toBe('');
  });

  // Das Komma ist das Trennzeichen. Frueher wurde nur das erste entfernt, ein
  // zweites haette das Feld beim Zuruecklesen zerteilt.
  it('entfernt Kommata aus beiden Teilen, nicht nur das erste', () => {
    expect(personName('van, der, Berg', 'Jan')).toBe('van der Berg, Jan');
  });

  // Zusicherung fuer den Rueckleseweg: fieldValue.split(', ') muss wieder in
  // dieselben zwei Felder zerfallen, sonst wandert der Vorname in das
  // Nachnamensfeld.
  it('bleibt durch splitPersonName wieder zerlegbar', () => {
    const [last, first] = splitPersonName(personName(undefined, 'Carolina'));
    expect(last).toBe('');
    expect(first).toBe('Carolina');
  });

  // Gegenstueck zur Ruby-Seite (api#440): Ein Altbestand "Ziegler, undefined"
  // landet ueber den Rueckleseweg sichtbar im Vornamensfeld. Ohne diese Regel
  // schriebe das naechste Speichern ihn unveraendert zurueck, die Altzeile
  // waere ueber die Oberflaeche nie loszuwerden.
  it('verwirft "undefined" auch als eingelesenen Namensteil', () => {
    expect(personName('Ziegler', 'undefined')).toBe('Ziegler');
    expect(personName('undefined', 'Carolina')).toBe(', Carolina');
    expect(personName('undefined', 'undefined')).toBe('');
  });
});

describe('splitPersonName', () => {
  it('zerlegt am Trennzeichen', () => {
    expect(splitPersonName('Ziegler, Carolina')).toEqual([
      'Ziegler',
      'Carolina',
    ]);
  });

  it('laesst den Vornamen Vorname bleiben, wenn der Nachname fehlt', () => {
    expect(splitPersonName(', Carolina')).toEqual(['', 'Carolina']);
  });

  it('liest einen Wert ohne Trennzeichen als Nachnamen', () => {
    expect(splitPersonName('Ziegler')).toEqual(['Ziegler', undefined]);
  });

  // Der eigentliche Grund fuer diese Funktion: split(', ') mit Zugriff auf [0]
  // und [1] liess bei Altbestaenden mit mehreren Kommata alles ab dem dritten
  // Teil fallen, und das naechste Speichern schrieb den verkuerzten Namen
  // zurueck.
  it('verliert bei mehreren Kommata keinen Namensteil', () => {
    expect(splitPersonName('van der, Berg, Jan')).toEqual([
      'van der',
      'Berg, Jan',
    ]);
  });

  // Zusicherung fuer den gemeinsamen Weg: Was personName erzeugt, muss
  // splitPersonName unveraendert wieder hergeben.
  it('ist zu personName invers', () => {
    ['Ziegler, Carolina', ', Carolina', 'Ziegler'].forEach((stored) => {
      const [last, first] = splitPersonName(stored);
      expect(personName(last, first)).toBe(stored);
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

  describe('technisches Tor', () => {
    let gameService: GameService;

    beforeEach(() => {
      gameService = TestBed.inject(GameService);
      component.type = 'goal';
      component.team = 'home';
      component.currentPeriod = '1';
      component.minutes = 12;
      component.seconds = 34;
      component.minutesValid = true;
      component.secondsValid = true;
      component.playerNumber = 7;
      component.match = {
        id: 1,
        league_id: 1,
        players: { home: [], guest: [] },
        referees: [],
        result: { home_goals: 0, guest_goals: 0 },
      } as unknown as Game;
    });

    // Auch ein zugesprochenes Tor kann vorbereitet worden sein: die Vorlage
    // bleibt erfassbar und geht unverändert mit.
    it('should send goal_type technical along with the assist', () => {
      const addEvent = spyOn(gameService, 'addEvent').and.returnValue(of([]));
      component.assistPlayerNumber = 9;
      component.technicalGoal = true;

      component.submitEvent();

      const payload = addEvent.calls.mostRecent().args[1];
      expect(payload.goal_type).toBe('technical');
      expect(payload.home_assist).toBe(9);
      expect(payload.penalty_code_id).toBeUndefined();
    });

    // Umstellen eines bestehenden Tores läuft über updateEvent statt addEvent,
    // also über den anderen Zweig von submitEvent.
    it('should keep the assist when converting an existing goal', () => {
      const updateEvent = spyOn(gameService, 'updateEvent').and.returnValue(
        of([])
      );
      component.existingEvent = {
        event_id: 5,
        event_type: 'goal',
        number: 7,
        assist: 9,
        time: '12:34',
        period: 1,
      } as GameEvent;
      component.ngOnInit();
      component.technicalGoal = true;

      component.submitEvent();

      const payload = updateEvent.calls.mostRecent().args[2];
      expect(payload.goal_type).toBe('technical');
      expect(payload.home_assist).toBe(9);
    });

    // „Eigentor" (1000) und „Nicht angegeben" (2000) verschwinden am
    // technischen Tor aus der Auswahl. Bliebe die Nummer im Modell stehen, ginge
    // sie mit, obwohl das Feld leer aussieht, und die Ereignisliste zeigte eine
    // Zeile ohne Namen und ohne Hinweis.
    // Die Nummer kommt aus einem <select> und liegt deshalb als String im
    // Modell, obwohl sie als number deklariert ist: Angulars NgSelectOption
    // registriert nur `[ngValue]` im Options-Map, bei `value`/`[value]` fällt
    // der Rohstring durch. Der Vergleich in onTechnicalGoalChange muss damit
    // umgehen (`>=` konvertiert numerisch, anders als ein Stringvergleich).
    it('should clear a pseudo scorer number when marking a technical goal', () => {
      component.playerNumber = '2000' as unknown as number;
      component.playerSearchNumber = 2000;
      component.technicalGoal = true;

      component.onTechnicalGoalChange();

      expect(component.playerNumber).toBe(0);
      // Auch das Suchfeld, sonst stünde dort weiter die verworfene Nummer.
      expect(component.playerSearchNumber).toBeUndefined();
      // Ohne Nummer ist das Speichern gesperrt, die Eingabe wird also erzwungen.
      expect(component.submitDisabled()).toBeTrue();
    });

    it('should keep a two-digit scorer number when marking a technical goal', () => {
      // Stringvergleich hätte hier zugeschlagen: '10' >= '1000' ist zwar
      // falsch, aber '99' >= '1000' wäre wahr.
      component.playerNumber = '99' as unknown as number;
      component.technicalGoal = true;

      component.onTechnicalGoalChange();

      expect(component.playerNumber).toBe('99' as unknown as number);
    });

    it('should keep a regular scorer number when marking a technical goal', () => {
      component.playerNumber = 7;
      component.technicalGoal = true;

      component.onTechnicalGoalChange();

      expect(component.playerNumber).toBe(7);
    });

    it('should keep sending the assist for a regular goal', () => {
      const addEvent = spyOn(gameService, 'addEvent').and.returnValue(of([]));
      component.assistPlayerNumber = 9;

      component.submitEvent();

      const payload = addEvent.calls.mostRecent().args[1];
      expect(payload.goal_type).toBeUndefined();
      expect(payload.home_assist).toBe(9);
    });

    it('should send the penalty-shot marker instead when that is selected', () => {
      const addEvent = spyOn(gameService, 'addEvent').and.returnValue(of([]));
      component.with_ps = true;

      component.submitEvent();

      const payload = addEvent.calls.mostRecent().args[1];
      expect(payload.penalty_code_id).toBe(23);
      expect(payload.goal_type).toBeUndefined();
    });

    // Ein Tor ist entweder erzielt oder zugesprochen, beides zusammen gibt es
    // nicht. Ohne die Kopplung ließen sich beide Haken setzen und nur einer
    // von beiden käme im Ereignis an.
    it('should keep penalty shot and technical goal mutually exclusive', () => {
      component.with_ps = true;
      component.technicalGoal = true;
      component.onTechnicalGoalChange();
      expect(component.with_ps).toBeFalse();

      component.with_ps = true;
      component.onWithPsChange();
      expect(component.technicalGoal).toBeFalse();
    });

    it('should pre-fill the marker when editing a technical goal', () => {
      component.existingEvent = {
        event_type: 'goal',
        goal_type: 'technical',
        number: 7,
        time: '12:34',
        period: 1,
      } as GameEvent;

      component.ngOnInit();

      expect(component.technicalGoal).toBeTrue();
      expect(component.with_ps).toBeFalse();
    });

    it('should not mark a penalty shot as a technical goal when editing', () => {
      component.existingEvent = {
        event_type: 'goal',
        goal_type: 'penalty_shot',
        number: 7,
        time: '12:34',
        period: 1,
      } as GameEvent;

      component.ngOnInit();

      expect(component.with_ps).toBeTrue();
      expect(component.technicalGoal).toBeFalse();
    });
  });

  // Die Entscheidung im Penalty-Schießen ist dasselbe gespeicherte Ereignis wie
  // der Strafschuss (Tor mit penalty_code_id 23), die API unterscheidet beide am
  // Spielabschnitt und liefert dafür „penalty_shots".
  describe('Entscheidung im Penalty-Schießen', () => {
    let gameService: GameService;

    // Wie beim Bearbeiten: die Elternkomponente bindet currentPeriod an den
    // Abschnitt des Ereignisses, nicht an den laufenden Abschnitt des Spiels
    // (siehe match-history-item.component.html).
    const shootoutGoal = {
      event_id: 5,
      event_type: 'goal',
      goal_type: 'penalty_shots',
      number: 7,
      time: '0:30',
      period: 5,
    } as GameEvent;

    beforeEach(() => {
      gameService = TestBed.inject(GameService);
      component.type = 'goal';
      component.team = 'home';
      component.currentPeriod = '5';
      component.match = {
        id: 1,
        league_id: 1,
        players: { home: [], guest: [] },
        referees: [],
        result: { home_goals: 0, guest_goals: 0 },
      } as unknown as Game;
    });

    it('should pre-fill the marker when editing a shootout decision', () => {
      component.existingEvent = shootoutGoal;

      component.ngOnInit();

      expect(component.with_ps).toBeTrue();
      expect(component.technicalGoal).toBeFalse();
    });

    it('should not mark a regular goal as a penalty shot when editing', () => {
      component.existingEvent = { ...shootoutGoal, goal_type: 'regular' };

      component.ngOnInit();

      expect(component.with_ps).toBeFalse();
    });

    // Der eigentliche Fehler: ohne die Vorbelegung ging der Strafcode beim
    // Speichern verloren und aus der Entscheidung wurde ein gewöhnliches Tor.
    it('should still send the penalty code when updating a shootout decision', () => {
      const updateEvent = spyOn(gameService, 'updateEvent').and.returnValue(
        of([])
      );
      component.existingEvent = shootoutGoal;
      component.ngOnInit();

      component.submitEvent();

      const payload = updateEvent.calls.mostRecent().args[2];
      // Die Torart selbst wird nicht übertragen, die API leitet sie aus
      // Strafcode und Abschnitt ab. Beides muss also unverändert mitgehen:
      // ohne den Abschnitt wäre die Entscheidung wieder ein Strafschuss.
      expect(payload.penalty_code_id).toBe(23);
      expect(payload.period).toBe(5);
    });
  });

  // Die Verdrahtung im Template, nicht die Methoden dahinter: ohne diese Tests
  // ließe sich die (ngModelChange)-Bindung oder die @if-Bedingung an den
  // Pseudo-Nummern entfernen, ohne dass irgendetwas rot wird. Beide Regeln
  // existieren aber nur in der Vorlage.
  //
  // Eigene TestBed, weil das Tor-Formular FormsModule und den
  // sortTrikotNumber-Pipe braucht; die übrigen Bausteine des Formulars fängt
  // NO_ERRORS_SCHEMA ab.
  describe('technisches Tor: Template', () => {
    let domFixture: ComponentFixture<MatchEventFormComponent>;
    let dom: MatchEventFormComponent;

    beforeEach(async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [HttpClientTestingModule, FormsModule],
        declarations: [MatchEventFormComponent, SortTrikotnumbersPipe],
        schemas: [NO_ERRORS_SCHEMA],
      }).compileComponents();

      domFixture = TestBed.createComponent(MatchEventFormComponent);
      dom = domFixture.componentInstance;
      dom.type = 'goal';
      dom.team = 'home';
      dom.currentPeriod = '1';
      dom.match = {
        id: 1,
        league_id: 1,
        players: { home: [], guest: [] },
        referees: [],
        period_titles: [],
        result: { home_goals: 0, guest_goals: 0 },
      } as unknown as Game;
      domFixture.detectChanges();
    });

    function checkbox(id: string): HTMLInputElement {
      return domFixture.nativeElement.querySelector(`#${id}`);
    }

    function optionTexts(select: HTMLSelectElement): string[] {
      return Array.from(
        select.querySelectorAll('option'),
        (option) => (option as HTMLOptionElement).textContent?.trim() ?? ''
      );
    }

    // Das Formular hat drei Auswahlfelder (Spielabschnitt, Schütze, Assist).
    // Über den ersten Eintrag statt über die Position, sonst hinge der Test an
    // der Reihenfolge im Template.
    function selectStartingWith(firstOption: string): HTMLSelectElement {
      const selects = Array.from(
        domFixture.nativeElement.querySelectorAll('select')
      ) as HTMLSelectElement[];
      const match = selects.find(
        (select) => optionTexts(select)[0] === firstOption
      );
      expect(match).withContext(`select "${firstOption}"`).toBeTruthy();
      return match as HTMLSelectElement;
    }

    function scorerOptionValues(): string[] {
      return Array.from(
        selectStartingWith('Bitte wählen...').querySelectorAll('option'),
        (option) => (option as HTMLOptionElement).value
      );
    }

    it('should offer both markers for a goal', () => {
      expect(checkbox('with_ps')).toBeTruthy();
      expect(checkbox('technical_goal')).toBeTruthy();
    });

    // Den Haken zurückzunehmen ist der zweite Schritt: ngModel schreibt den
    // Wert erst im nächsten Microtask in die Ansicht, ein detectChanges()
    // allein lässt die Checkbox noch gesetzt aussehen. Deshalb fakeAsync/tick,
    // sonst prüfte der Test nur das Modell und nicht, was der Nutzer sieht.
    it('should uncheck the penalty shot when the technical marker is ticked', fakeAsync(() => {
      const ps = checkbox('with_ps');
      ps.click();
      domFixture.detectChanges();
      expect(dom.with_ps).toBeTrue();

      checkbox('technical_goal').click();
      tick();
      domFixture.detectChanges();

      expect(dom.technicalGoal).toBeTrue();
      expect(dom.with_ps).toBeFalse();
      expect(ps.checked).toBeFalse();
    }));

    it('should uncheck the technical marker when the penalty shot is ticked', fakeAsync(() => {
      const technical = checkbox('technical_goal');
      technical.click();
      domFixture.detectChanges();

      checkbox('with_ps').click();
      tick();
      domFixture.detectChanges();

      expect(dom.with_ps).toBeTrue();
      expect(dom.technicalGoal).toBeFalse();
      expect(technical.checked).toBeFalse();
    }));

    it('should hide the pseudo scorer numbers for a technical goal', () => {
      expect(scorerOptionValues()).toContain('1000');
      expect(scorerOptionValues()).toContain('2000');

      checkbox('technical_goal').click();
      domFixture.detectChanges();

      // Ohne Namen dahinter bliebe die Ereigniszeile leer, siehe
      // formatted_events in der API.
      expect(scorerOptionValues()).not.toContain('1000');
      expect(scorerOptionValues()).not.toContain('2000');
    });

    it('should keep the assist fields for a technical goal', () => {
      checkbox('technical_goal').click();
      domFixture.detectChanges();

      // Auch ein zugesprochenes Tor kann vorbereitet worden sein. Die erste
      // Fassung blendete die Vorlage hier aus, das war falsch.
      expect(selectStartingWith('Kein Assist')).toBeTruthy();
    });
  });
});

describe('MatchEventFormComponent startOrEndGame', () => {
  let component: MatchEventFormComponent;
  let notifications: NotificationService;
  let previousUnhandledError: typeof rxjsConfig.onUnhandledError;

  // Ohne eigenen error-Zweig läuft der Fehlschlag weiter -- genau so gehört es
  // sich, damit der globale ErrorHandler (in Produktion Sentry) ihn sieht. RxJS
  // meldet ihn deshalb als unbehandelt und würde die Spec-Datei in ein afterAll
  // reißen; für diesen Block stillgelegt. Dass die Stilllegung nötig ist, ist
  // zugleich der Beleg, dass der Weg nach Sentry offen ist.
  beforeAll(() => {
    previousUnhandledError = rxjsConfig.onUnhandledError;
    rxjsConfig.onUnhandledError = () => undefined;
  });

  afterAll(() => {
    rxjsConfig.onUnhandledError = previousUnhandledError;
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [MatchEventFormComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const fixture = TestBed.createComponent(MatchEventFormComponent);
    component = fixture.componentInstance;
    component.type = 'start';
    component.match = {
      id: 42,
      started: false,
      referees: [],
    } as unknown as Game;
    notifications = TestBed.inject(NotificationService);
  });

  // Der Kern des Fehlers vom 30.08.2026: Der Interceptor zeigt die Begründung des
  // Servers ("... Schiedsrichter 1 ...") bereits an. Eine zweite, generische
  // Meldung der Komponente legte sich deckungsgleich darüber und machte die
  // Begründung unlesbar -- 23 Startversuche über 88 Minuten.
  it('zeigt bei einer abgewiesenen Startanfrage keine eigene Meldung', () => {
    const gameService = TestBed.inject(GameService);
    spyOn(gameService, 'setGameFlags').and.returnValue(
      throwError(() => ({ status: 422, error: { message: 'Schiri 1 fehlt.' } }))
    );
    const errorToast = spyOn(notifications, 'error');

    component.startOrEndGame(true);

    expect(gameService.setGameFlags).toHaveBeenCalled();
    expect(errorToast).not.toHaveBeenCalled();
  });
});
