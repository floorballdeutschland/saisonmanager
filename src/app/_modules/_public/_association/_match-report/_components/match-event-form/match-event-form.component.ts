import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  GameService,
  LeagueService,
  NotificationService,
} from '@floorball/core';
import {
  Game,
  GameAdditionalFields,
  GameEvent,
  GameFields,
  GameFlags,
  League,
  Penalty,
  PenaltyCode,
  PeriodTitles,
  RefereeEntry,
} from '@floorball/types';
import {
  formatSecondsAsGameTime,
  getPeriodMaxSeconds,
  isEventTimeValid,
} from './event-time-validation';
import { personName, splitPersonName } from './person-name';

@Component({
  selector: 'fb-match-event-form',
  templateUrl: './match-event-form.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class MatchEventFormComponent implements OnInit, AfterViewInit {
  @ViewChild('minutefield')
  minutefieldElement!: ElementRef<HTMLInputElement>;

  @ViewChild('secondsfield')
  secondsfieldElement!: ElementRef<HTMLInputElement>;

  @ViewChild('playerSearchField')
  playerSearchFieldElement!: ElementRef<HTMLInputElement>;

  @ViewChild('assistSearchField')
  assistSearchFieldElement!: ElementRef<HTMLInputElement>;

  @Input()
  fieldValue?: string;

  @Input()
  fieldChecked? = false;

  @Input()
  currentPeriod!: string;

  @Input()
  type!: string;

  @Input()
  team!: string;

  @Input()
  match!: Game;

  @Input()
  additionalFields?: GameAdditionalFields;

  @Input()
  penalties!: Penalty[];

  @Input()
  penaltyCodes!: PenaltyCode[];

  @Input()
  noBackground = false;

  @Input()
  existingEvent?: GameEvent;

  @Output()
  updatePeriod: EventEmitter<string> = new EventEmitter<string>();

  @Output()
  updateGame: EventEmitter<void> = new EventEmitter<void>();

  @Output()
  scrollToSbbNavigation: EventEmitter<void> = new EventEmitter<void>();

  editLive = true;
  startTime = '';
  minutes?: number;
  minutesValid = false;
  seconds?: number;
  secondsValid = false;
  league: League | null = null;

  // Zeit und Spielabschnitt, mit denen ein Bestandsereignis geladen wurde
  // („<minuten>:<sekunden>" bzw. die Periodennummer). Solange beide unverändert
  // sind, blockiert eine Zeit außerhalb des Abschnitts das Speichern nicht
  // (siehe timeBlocksSubmit).
  private _storedTime: string | null = null;
  private _storedPeriod: number | null = null;

  playerSearchNumber?: number;
  playerNumber = 0;
  assistError = false;
  assistPlayerSearchNumber?: number;
  assistPlayerNumber = 0;
  playerError = false;
  penalty = 0;
  penaltyCode = 0;
  with_ps?: boolean;
  technicalGoal?: boolean;

  coach1 = { firstname: '', lastname: '' };
  coach2 = { firstname: '', lastname: '' };
  coach3 = { firstname: '', lastname: '' };
  coach4 = { firstname: '', lastname: '' };
  coach5 = { firstname: '', lastname: '' };

  comment?: string;
  visitors?: number;
  livestream?: string;
  vodstream?: string;
  recordkeeper?: string;
  recordkeeperFirstname?: string;
  recordkeeperLastname?: string;
  timekeeperFirstname?: string;
  timekeeperLastname?: string;
  selectedReferee1: RefereeEntry | null = null;
  selectedReferee2: RefereeEntry | null = null;

  protest?: boolean;
  specialevent?: boolean;
  specialEventString?: string;
  overtime?: boolean;

  timekeepersigned?: boolean;
  recordkeepersigned?: boolean;
  referee1signed?: boolean;
  referee2signed?: boolean;
  captainsignedhome?: boolean;
  captainsignedvisitor?: boolean;

  constructor(
    private _gameService: GameService,
    private _leagueService: LeagueService,
    private _notificationService: NotificationService,
    private _cdr: ChangeDetectorRef
  ) {}

  public ngOnInit(): void {
    // Liga-Einstellungen (Perioden, Periodenlänge, Verlängerung) für die
    // Validierung der Ereigniszeit laden – nur für zeitbehaftete Ereignisse.
    if (
      ['goal', 'penalty', 'timeout'].includes(this.type) &&
      this.match?.league_id
    ) {
      this._leagueService.getSingleLeague(this.match.league_id).subscribe({
        next: (league) => {
          this.league = league;
          this._cdr.markForCheck();
        },
        error: () => {},
      });
    }

    if (this.type === 'referee1' && this.match.referees[0]) {
      const r = this.match.referees[0];
      this.selectedReferee1 = {
        lizenznummer: parseInt(r.license_id, 10) || 0,
        nachname: r.last_name,
        vorname: r.first_name,
      };
    }

    if (this.type === 'referee2' && this.match.referees[1]) {
      const r = this.match.referees[1];
      this.selectedReferee2 = {
        lizenznummer: parseInt(r.license_id, 10) || 0,
        nachname: r.last_name,
        vorname: r.first_name,
      };
    }

    if (this.type === 'coach1') {
      this.coach1 = {
        firstname:
          this.team === 'home'
            ? this.additionalFields?.home_team_coaches?.coach1_first_name || ''
            : this.additionalFields?.guest_team_coaches?.coach1_first_name ||
              '',
        lastname:
          this.team === 'home'
            ? this.additionalFields?.home_team_coaches?.coach1_last_name || ''
            : this.additionalFields?.guest_team_coaches?.coach1_last_name || '',
      };
    }
    if (this.type === 'coach2') {
      this.coach2 = {
        firstname:
          this.team === 'home'
            ? this.additionalFields?.home_team_coaches?.coach2_first_name || ''
            : this.additionalFields?.guest_team_coaches?.coach2_first_name ||
              '',
        lastname:
          this.team === 'home'
            ? this.additionalFields?.home_team_coaches?.coach2_last_name || ''
            : this.additionalFields?.guest_team_coaches?.coach2_last_name || '',
      };
    }
    if (this.type === 'coach3') {
      this.coach3 = {
        firstname:
          this.team === 'home'
            ? this.additionalFields?.home_team_coaches?.coach3_first_name || ''
            : this.additionalFields?.guest_team_coaches?.coach3_first_name ||
              '',
        lastname:
          this.team === 'home'
            ? this.additionalFields?.home_team_coaches?.coach3_last_name || ''
            : this.additionalFields?.guest_team_coaches?.coach3_last_name || '',
      };
    }
    if (this.type === 'coach4') {
      this.coach4 = {
        firstname:
          this.team === 'home'
            ? this.additionalFields?.home_team_coaches?.coach4_first_name || ''
            : this.additionalFields?.guest_team_coaches?.coach4_first_name ||
              '',
        lastname:
          this.team === 'home'
            ? this.additionalFields?.home_team_coaches?.coach4_last_name || ''
            : this.additionalFields?.guest_team_coaches?.coach4_last_name || '',
      };
    }
    if (this.type === 'coach5') {
      this.coach5 = {
        firstname:
          this.team === 'home'
            ? this.additionalFields?.home_team_coaches?.coach5_first_name || ''
            : this.additionalFields?.guest_team_coaches?.coach5_first_name ||
              '',
        lastname:
          this.team === 'home'
            ? this.additionalFields?.home_team_coaches?.coach5_last_name || ''
            : this.additionalFields?.guest_team_coaches?.coach5_last_name || '',
      };
    }

    if (this.fieldValue) {
      switch (this.type) {
        case 'specialevent':
          this.specialEventString = this.fieldValue || '';
          break;
        case 'comment':
          this.comment = this.fieldValue || '';
          break;
        case 'visitors':
          this.visitors = parseInt(this.fieldValue || '', 10);
          break;
        case 'livestream':
          this.livestream = this.fieldValue;
          break;
        case 'vodstream':
          this.vodstream = this.fieldValue;
          break;
        case 'recordkeeper':
          [this.recordkeeperLastname, this.recordkeeperFirstname] =
            splitPersonName(this.fieldValue);
          break;
        case 'timekeeper':
          [this.timekeeperLastname, this.timekeeperFirstname] = splitPersonName(
            this.fieldValue
          );
          break;
        case 'referee1':
          // this.refereeNumber1 = parseInt(this.fieldValue || '', 10);
          break;
        case 'referee2':
          // this.refereeNumber2 = parseInt(this.fieldValue || '', 10);
          break;
      }
    }

    if (this.fieldChecked) {
      switch (this.type) {
        case 'timekeepersigned':
          this.timekeepersigned = this.fieldChecked;
          break;
        case 'recordkeepersigned':
          this.recordkeepersigned = this.fieldChecked;
          break;
        case 'referee1signed':
          this.referee1signed = this.fieldChecked;
          break;
        case 'referee2signed':
          this.referee2signed = this.fieldChecked;
          break;
        case 'protest':
          this.protest = this.fieldChecked;
          break;
        case 'overtime':
          this.overtime = this.fieldChecked;
          break;
        case 'specialevent':
          this.specialevent = this.fieldChecked;
          break;
        case 'captainsigned':
          if (this.team === 'home') {
            this.captainsignedhome = this.fieldChecked;
          } else {
            this.captainsignedvisitor = this.fieldChecked;
          }
          break;
      }
    }

    if (this.existingEvent) {
      const e = this.existingEvent;
      const timeParts = e.time?.split(':');
      this.minutes = timeParts?.[0] ? parseInt(timeParts[0], 10) : undefined;
      this.seconds = timeParts?.[1] ? parseInt(timeParts[1], 10) : undefined;
      this.minutesValid = this.minutes !== undefined;
      this.secondsValid = this.seconds !== undefined;
      this._storedTime =
        this.minutes !== undefined && this.seconds !== undefined
          ? `${this.minutes}:${this.seconds}`
          : null;
      this._storedPeriod = this.eventPeriod();

      this.playerNumber = e.number ?? 0;
      this.assistPlayerNumber = e.assist ?? 0;

      if (e.event_type === 'penalty') {
        this.penalty = e.penalty_id ?? 0;
        this.penaltyCode = e.penalty_code_id ?? 0;
      } else if (e.event_type === 'goal') {
        this.penaltyCode = e.penalty_code_id ?? 0;
        // Strafschuss („penalty_shot") und die Entscheidung im Penalty-Schießen
        // („penalty_shots") sind dasselbe gespeicherte Ereignis, die API leitet
        // die Unterscheidung aus dem Spielabschnitt ab. Ohne den zweiten Wert
        // bliebe der Haken beim Bearbeiten einer Penalty-Entscheidung aus, und
        // das Speichern machte daraus ein gewöhnliches Tor.
        this.with_ps = ['penalty_shot', 'penalty_shots'].includes(
          e.goal_type ?? ''
        );
        this.technicalGoal = e.goal_type === 'technical';
      }
    }
  }

  public ngAfterViewInit() {
    this.minutefieldElement?.nativeElement?.focus();
  }

  getEventString(): string {
    switch (this.type) {
      case 'goal':
        return 'Tor';
      case 'penalty':
        return 'Strafe';
      case 'timeout':
        return 'Time-Out';
      default:
        return '';
    }
  }

  public pad(number: number, size: number): string {
    let s = String(number);
    while (s.length < (size || 2)) {
      s = '0' + s;
    }
    return s;
  }

  public hasCoach(index: number): boolean {
    const coaches =
      this.team === 'home'
        ? this.additionalFields?.home_team_coaches
        : this.additionalFields?.guest_team_coaches;
    type CoachKey = keyof GameAdditionalFields['home_team_coaches'];
    return !!(
      coaches?.[`coach${index}_first_name` as CoachKey] ||
      coaches?.[`coach${index}_last_name` as CoachKey]
    );
  }

  // Betreuer-Plätze mit hinterlegtem Namen. Nur diese sind als Strafenempfänger
  // wählbar: Betreuer haben keine Trikotnummer, sie werden über die
  // Pseudo-Nummern 2001–2005 geführt (2000 + Platz), die NormalizeEventPipe
  // wieder in den Namen auflöst. Ein leerer Platz hat keinen Namen, das Ereignis
  // wäre in der Ereignisliste und öffentlich nicht zuordenbar – und weil die
  // Anzeige des Strafgrundes am aufgelösten Namen hängt, verschwindet dann auch
  // dieser. Deshalb prüft die Handeingabe (searchPlayerByNumber) dieselbe
  // Bedingung.
  public coachNumbers(): number[] {
    return [1, 2, 3, 4, 5].filter((num) => this.hasCoach(num));
  }

  public coachName(index: number): string {
    const coaches =
      this.team === 'home'
        ? this.additionalFields?.home_team_coaches
        : this.additionalFields?.guest_team_coaches;
    type CoachKey = keyof GameAdditionalFields['home_team_coaches'];
    const fn = (coaches?.[`coach${index}_first_name` as CoachKey] ??
      '') as string;
    const ln = (coaches?.[`coach${index}_last_name` as CoachKey] ??
      '') as string;
    return [fn, ln].filter(Boolean).join(' ');
  }

  public searchPlayerByNumber(side: string, number: number, isAssist: boolean) {
    // Betreuer-Pseudo-Nummern: nur belegte Plätze zulassen, sonst entstünde ein
    // Ereignis ohne auflösbaren Namen (siehe coachNumbers). Das Dropdown bietet
    // leere Plätze nicht an, hier von Hand eingetippt kamen sie bisher durch.
    if (number >= 2001 && number <= 2005 && !isAssist) {
      const named = this.hasCoach(number - 2000);
      this.playerNumber = named ? number : 0;
      this.playerError = !named;
      return;
    }

    const tmpSide = side === 'home' ? 'home' : 'guest';
    const player = this.match.players[tmpSide]?.find(
      (p) => p.trikot_number === number
    );

    if (isAssist) {
      this.assistError = number !== 0 && !player;
    } else {
      this.playerError = number !== 0 && !player;
    }

    if (isAssist) {
      this.assistPlayerNumber = player?.trikot_number || 0;
    } else {
      this.playerNumber = player?.trikot_number || 0;
    }

    if (
      !isAssist &&
      this.playerSearchFieldElement &&
      this.assistSearchFieldElement
    ) {
      if (
        this.playerSearchFieldElement.nativeElement.value.length >= 2 &&
        !this.playerError
      ) {
        this.assistSearchFieldElement.nativeElement.focus();
      }
    }
  }

  // Strafschuss und technisches Tor schließen sich aus: ein Tor ist entweder
  // erzielt oder zugesprochen.
  //
  // „Eigentor" (1000) und „Nicht angegeben" (2000) stehen anstelle eines
  // Schützen und verschwinden am technischen Tor aus der Auswahl. War einer der
  // beiden vorher gewählt, muss er auch aus dem Modell fallen, sonst ginge er
  // mit, obwohl das Feld leer aussieht; submitDisabled() verlangt dann eine
  // Nummer, bevor gespeichert werden kann.
  public onTechnicalGoalChange(): void {
    if (this.technicalGoal) {
      this.with_ps = false;
      if (this.playerNumber >= 1000) {
        this.playerNumber = 0;
        this.playerSearchNumber = undefined;
      }
    }
  }

  // Gegenstück zu onTechnicalGoalChange, hält dieselbe Bedingung von der
  // anderen Seite. Beide werden aus dem Template heraus aufgerufen; ohne die
  // (ngModelChange)-Bindung am jeweiligen Haken greift der Ausschluss nicht.
  public onWithPsChange(): void {
    if (this.with_ps) {
      this.technicalGoal = false;
    }
  }

  public submitDisabled(): boolean {
    return (
      (!this.editLive && this.startTime === '') ||
      (['penalty'].includes(this.type) &&
        (!this.penaltyCode || !this.penalty)) ||
      (['goal', 'penalty'].includes(this.type) && !this.playerNumber) ||
      (['goal', 'penalty', 'timeout'].includes(this.type) &&
        (!this.minutesValid || !this.secondsValid || this.timeBlocksSubmit()))
    );
  }

  private eventPeriod(): number {
    return parseInt(
      this.currentPeriod || this.existingEvent?.period?.toString() || '',
      10
    );
  }

  // Auswählbare Spielabschnitte des Ereignis-Formulars. Im Penalty-Schießen
  // gibt es keine Auszeiten, deshalb steht der Abschnitt bei Time-Outs nicht
  // zur Wahl. Der Live-Fall (laufendes Penalty-Schießen) wird zusätzlich in
  // der Spielbericht-Ansicht über deaktivierte Buttons abgefangen.
  public selectablePeriods(): PeriodTitles[] {
    return this.match.period_titles.filter(
      (period) =>
        period.running &&
        !(this.type === 'timeout' && period.status_id === 'penalty_shots')
    );
  }

  public periodMaxSeconds(): number | null {
    return getPeriodMaxSeconds(this.league, this.eventPeriod());
  }

  public timeOutOfRange(): boolean {
    if (this.minutes === undefined || this.minutes === null) {
      return false;
    }
    return !isEventTimeValid(
      this.periodMaxSeconds(),
      this.minutes,
      this.seconds ?? 0
    );
  }

  // Eine Zeit außerhalb des Abschnitts sperrt das Speichern nur, wenn sie in
  // diesem Formular eingegeben oder geändert wurde. Bestandsereignisse mit
  // abweichend erfasster Zeit (in Ligen mit Abschnittslänge tragen einzelne
  // Zeitnehmer die kumulierte Spielzeit ein) bleiben so bearbeitbar – sonst
  // wäre an ihnen auch keine Trikotnummer mehr korrigierbar. Der Hinweis am
  // Zeitfeld erscheint trotzdem, damit die Abweichung sichtbar bleibt.
  public timeBlocksSubmit(): boolean {
    if (!this.timeOutOfRange()) {
      return false;
    }
    // Auch der Abschnitt zählt zum geladenen Stand: er bestimmt die Obergrenze.
    // Ohne diese Prüfung ließe ein Abschnittswechsel bei unveränderter Zeit die
    // Sperre umgehen – etwa bei einem Penalty-Schießen-Ereignis (Zeit dort per
    // Konvention kumuliert, z. B. 70:00), das anschließend auf ein Drittel
    // umgestellt wird.
    return (
      this._storedPeriod !== this.eventPeriod() ||
      this._storedTime !== `${this.minutes}:${this.seconds}`
    );
  }

  public timeRangeErrorText(): string {
    const maxSeconds = this.periodMaxSeconds();
    if (maxSeconds === null) {
      return 'Ungültige Zeitangabe.';
    }
    return (
      'Die Zeit liegt außerhalb des gewählten Spielabschnitts ' +
      `(erlaubt: 0:00 bis ${formatSecondsAsGameTime(maxSeconds)}).`
    );
  }

  public startOrEndGame(startGame: boolean) {
    const gameFlag = startGame ? 'started' : 'ended';

    this._gameService
      .setGameFlags(this.match.id, {
        [gameFlag]: true,
        ...(!startGame ? { overtime: this.decidedInOvertime() } : {}),
      })
      .subscribe({
        next: () => {
          if (!this.match.started) {
            const hours = new Date(Date.now()).getHours();
            const minutes = new Date(Date.now()).getMinutes();
            this._gameService
              .setGameField(this.match.id, {
                actual_start_time: this.editLive
                  ? `${hours}:${this.pad(minutes, 2)}`
                  : this.startTime,
              })
              .subscribe();
          }

          if (this.match.period_titles && startGame) {
            const nextPeriod = this.nextPeriodTitle();
            this._gameService
              .setInGameStatus(this.match.id, nextPeriod?.status_id || '')
              .subscribe({
                next: () => {
                  this.scrollToSbbNavigation.emit();

                  this._notificationService.success('Spiel gestartet', {
                    autoClose: true,
                    keepAfterRouteChange: true,
                  });
                  this.updateGame.emit();
                },
              });
          }

          if (!startGame) {
            this._gameService
              .setGameStatus(this.match.id, 'aftergame')
              .subscribe({
                next: () => {
                  this.scrollToSbbNavigation.emit();

                  this._notificationService.success('Spiel beendet', {
                    autoClose: true,
                    keepAfterRouteChange: true,
                  });
                  this.updateGame.emit();
                },
              });
          }
        },
        // Bewusst OHNE error-Zweig: Der ErrorInterceptor zeigt die Begründung des
        // Servers bei 422 selbst an und reicht danach die HttpErrorResponse
        // weiter. Hier stand eine eigene Meldung mit `typeof err === 'string'`,
        // aus der Zeit, als der Interceptor bei 422 schwieg und einen String warf.
        // Seit er beides umgestellt hat, war der String-Zweig toter Code und es
        // lief immer der Ersatztext "Aktion nicht möglich." -- deckungsgleich
        // ÜBER der Begründung, denn die Meldungen liegen `fixed` ohne Versatz
        // übereinander und der spätere gewinnt.
        //
        // Was das kostet, ist belegt: Am 30.08.2026 blieb dem Spielsekretariat der
        // U13 KF RL Ost in Wernigerode 88 Minuten und 23 Startversuche lang
        // verborgen, dass die Absage das Feld "Schiedsrichter 1" meinte -- das
        // Gespann stand in Feld 2. Ohne eigenen Zweig läuft der Fehler zudem
        // weiter in Angulars ErrorHandler und damit nach Sentry.
      });
  }

  public submitEvent() {
    const time = this.minutes + ':' + this.pad(this.seconds || 0, 2);

    const home_goals =
      this.type === 'goal' && this.team === 'home'
        ? (this.match.result?.home_goals || 0) + 1
        : this.match.result?.home_goals || 0;

    const guest_goals =
      this.type === 'goal' && this.team === 'guest'
        ? (this.match.result?.guest_goals || 0) + 1
        : this.match.result?.guest_goals || 0;

    switch (this.type) {
      case 'next':
        const nextPeriod = this.nextPeriodTitle();
        this._gameService
          .setInGameStatus(this.match.id, nextPeriod?.status_id || '')
          .subscribe({
            next: () => {
              this.scrollToSbbNavigation.emit();
              this._notificationService.success(
                `${nextPeriod?.title || ''} gestartet`,
                {
                  autoClose: true,
                  keepAfterRouteChange: true,
                }
              );
              this.updateGame.emit();
            },
          });
        break;
      case 'goal':
        if (this.currentPeriod || this.existingEvent) {
          // fix typeerror with tostring and parseint
          // eslint-disable-next-line prefer-const
          let goal: {
            home_number?: number;
            home_assist?: number;
            guest_number?: number;
            guest_assist?: number;
            penalty_code_id?: number;
            goal_type?: string;
          } =
            this.team === 'home'
              ? {
                  home_number: parseInt(this.playerNumber.toString(), 10),
                  home_assist: parseInt(this.assistPlayerNumber.toString(), 10),
                }
              : {
                  guest_number: parseInt(this.playerNumber.toString(), 10),
                  guest_assist: parseInt(
                    this.assistPlayerNumber.toString(),
                    10
                  ),
                };

          if (this.technicalGoal) {
            goal.goal_type = 'technical';
          } else if (this.with_ps) {
            goal.penalty_code_id = 23;
          }

          const goalPayload = {
            time,
            event_type: 'goal',
            event_team: this.team,
            period: parseInt(
              this.currentPeriod ||
                this.existingEvent?.period?.toString() ||
                '1',
              10
            ),
            home_goals,
            guest_goals,
            ...goal,
          };

          if (this.existingEvent) {
            this._gameService
              .updateEvent(
                this.match.id,
                this.existingEvent.event_id,
                goalPayload
              )
              .subscribe(() => {
                this.updateGame.emit();
                this._notificationService.success('Tor aktualisiert', {
                  autoClose: true,
                  keepAfterRouteChange: true,
                });
              });
          } else {
            this._gameService
              .addEvent(this.match.id, goalPayload)
              .subscribe(() => {
                this.updateGame.emit();
                this._notificationService.success('Tor hinzugefügt', {
                  autoClose: true,
                  keepAfterRouteChange: true,
                });
              });
          }
        }
        break;
      case 'penalty':
        if (this.currentPeriod || this.existingEvent) {
          const penaltyPayload = {
            time,
            event_type: 'penalty',
            event_team: this.team,
            period: parseInt(
              this.currentPeriod ||
                this.existingEvent?.period?.toString() ||
                '1',
              10
            ),
            home_goals,
            guest_goals,
            [this.team === 'home' ? 'home_number' : 'guest_number']: parseInt(
              this.playerNumber.toString(),
              10
            ),
            penalty_id: this.penalty,
            penalty_code_id: this.penaltyCode,
          };

          if (this.existingEvent) {
            this._gameService
              .updateEvent(
                this.match.id,
                this.existingEvent.event_id,
                penaltyPayload
              )
              .subscribe(() => {
                this._notificationService.success('Strafe aktualisiert', {
                  autoClose: true,
                  keepAfterRouteChange: true,
                });
                this.updateGame.emit();
              });
          } else {
            this._gameService
              .addEvent(this.match.id, penaltyPayload)
              .subscribe(() => {
                this._notificationService.success('Strafe hinzugefügt', {
                  autoClose: true,
                  keepAfterRouteChange: true,
                });
                this.updateGame.emit();
              });
          }
        }
        break;
      case 'timeout':
        const field =
          this.team === 'home' ? 'home_timeout_string' : 'guest_timeout_string';
        this._gameService
          .setGameField(this.match.id, {
            [field]: `${time} / ${this.currentPeriod}`,
          })
          .subscribe({
            next: () => {
              this._notificationService.success('Timout hinzugefügt', {
                autoClose: true,
                keepAfterRouteChange: true,
              });
              this.updateGame.emit();
            },
          });
        break;
    }
  }

  public onRefereeSelected(num: 1 | 2, referee: RefereeEntry | null): void {
    if (num === 1) {
      this.selectedReferee1 = referee;
    } else {
      this.selectedReferee2 = referee;
    }
  }

  public submitField() {
    let fields: GameFields = {};
    let saveMessage = '';
    switch (this.type) {
      case 'coach1':
      case 'coach2':
      case 'coach3':
      case 'coach4':
      case 'coach5':
        this._gameService
          .setCoach(
            this.match.id,
            this.team,
            parseInt(this.type.replace('coach', ''), 10),
            this[this.type].firstname,
            this[this.type].lastname
          )
          .subscribe({
            next: () => {
              this._notificationService.success(
                'Betreuer ' + this.type.replace('coach', '') + ' gespeichert',
                {
                  autoClose: true,
                  keepAfterRouteChange: true,
                }
              );
              this.updateGame.emit();
            },
          });
        break;
      case 'specialevent':
        fields = { special_event_string: this.specialEventString || '' };
        saveMessage = 'Besonderes Ereignis gespeichert';
        break;
      case 'comment':
        fields = { record_comment: this.comment?.toString() || '' };
        saveMessage = 'Kommentar gespeichert';
        break;
      case 'visitors':
        fields = { audience: this.visitors?.toString() || '' };
        saveMessage = 'Zuschauerzahl gespeichert';
        break;
      case 'livestream':
        fields = { live_stream_link: this.livestream || '' };
        saveMessage = 'Livestream Link gespeichert';
        break;
      case 'vodstream':
        fields = { vod_link: this.vodstream || '' };
        saveMessage = 'VOD Link gespeichert';
        break;
      case 'recordkeeper':
        fields = {
          record_keeper_string: personName(
            this.recordkeeperLastname,
            this.recordkeeperFirstname
          ),
        };
        saveMessage = 'Schriftführer/in gespeichert';
        break;
      case 'timekeeper':
        fields = {
          time_keeper_string: personName(
            this.timekeeperLastname,
            this.timekeeperFirstname
          ),
        };
        saveMessage = 'Zeitnehmer/in gespeichert';
        break;
      case 'referee1':
        this._gameService
          .setReferee(
            this.match.id,
            1,
            this.selectedReferee1?.lizenznummer || 0,
            this.selectedReferee1?.nachname || '',
            this.selectedReferee1?.vorname || ''
          )
          .subscribe({
            next: () => {
              this._notificationService.success(
                'Schiedsrichter 1 gespeichert',
                {
                  autoClose: true,
                  keepAfterRouteChange: true,
                }
              );
              this.updateGame.emit();
            },
          });
        break;
      case 'referee2':
        this._gameService
          .setReferee(
            this.match.id,
            2,
            this.selectedReferee2?.lizenznummer || 0,
            this.selectedReferee2?.nachname || '',
            this.selectedReferee2?.vorname || ''
          )
          .subscribe({
            next: () => {
              this._notificationService.success(
                'Schiedsrichter 2 gespeichert',
                {
                  autoClose: true,
                  keepAfterRouteChange: true,
                }
              );
              this.updateGame.emit();
            },
          });
        break;
    }

    if (Object.keys(fields).length) {
      this._gameService.setGameField(this.match.id, fields).subscribe({
        next: () => {
          this._notificationService.success(saveMessage, {
            autoClose: true,
            keepAfterRouteChange: true,
          });
          this.updateGame.emit();
        },
      });
    }
  }

  public submitFlag() {
    let flags: GameFlags = {};
    let saveMessage = '';
    switch (this.type) {
      case 'protest':
        flags = { protest: this.protest };
        saveMessage = 'Protest gespeichert';
        break;
      case 'specialevent':
        flags = { special_event: this.specialevent };
        saveMessage = 'Besonderes Ereignis gespeichert';
        break;
      case 'overtime':
        flags = { overtime: this.overtime };
        saveMessage = 'Verlängerung gespeichert';
        break;
      case 'timekeepersigned':
        flags = { time_keeper_signed: this.timekeepersigned };
        saveMessage = 'Unterschrift Zeitnehmer/in gespeichert';
        break;
      case 'recordkeepersigned':
        flags = { record_keeper_signed: this.recordkeepersigned };
        saveMessage = 'Unterschrift Schriftführer/in gespeichert';
        break;
      case 'referee1signed':
        flags = { referee1_signed: this.referee1signed };
        saveMessage = 'Unterschrift Schiedsrichter 1 gespeichert';
        break;
      case 'referee2signed':
        flags = { referee2_signed: this.referee2signed };
        saveMessage = 'Unterschrift Schiedsrichter 2 gespeichert';
        break;
      case 'captainsigned':
        if (this.team === 'home') {
          flags = { home_captain_signed: this.captainsignedhome };
          saveMessage = 'Unterschrift Kapitän Heim gespeichert';
        } else {
          flags = { guest_captain_signed: this.captainsignedvisitor };
          saveMessage = 'Unterschrift Kapitän Gast gespeichert';
        }
        break;
    }

    if (Object.keys(flags).length) {
      this._gameService.setGameFlags(this.match.id, flags).subscribe({
        next: () => {
          this._notificationService.success(saveMessage, {
            autoClose: true,
            keepAfterRouteChange: true,
          });
          this.updateGame.emit();
        },
      });
    }
  }

  public changePeriod(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    if (value) {
      // lokal nachziehen, damit die Zeitvalidierung sofort den neuen
      // Spielabschnitt berücksichtigt (der Input wird erst durch den
      // Parent aktualisiert)
      this.currentPeriod = value;
      this.updatePeriod?.emit(value);
    }
  }

  public onMinutesChange() {
    if (this.minutefieldElement) {
      const valueLength =
        this.minutefieldElement.nativeElement.value.length || 0;
      if (valueLength >= 2) {
        const inputValue = (
          this.minutefieldElement.nativeElement.value || ''
        ).substring(0, 2);
        this.minutes = parseInt(inputValue, 10);
        this.minutefieldElement.nativeElement.value = inputValue;
        this.secondsfieldElement?.nativeElement?.focus();
        this.secondsfieldElement?.nativeElement?.select();
        this._cdr.markForCheck();
      }

      this.minutesValid = this.minutes !== undefined && this.minutes !== null;
    }
  }

  public onSecondsChange() {
    if (this.secondsfieldElement) {
      const valueLength =
        this.secondsfieldElement.nativeElement.value.length || 0;
      if (valueLength >= 2) {
        const inputValue = (
          this.secondsfieldElement.nativeElement.value || ''
        ).substring(0, 2);
        this.seconds = parseInt(inputValue, 10);
        this.secondsfieldElement.nativeElement.value = inputValue;
        this.playerSearchFieldElement?.nativeElement?.focus();
        this.playerSearchFieldElement?.nativeElement?.select();
        this._cdr.markForCheck();
      }

      this.secondsValid = this.seconds !== undefined && this.seconds !== null;
    }
  }

  public currentPeriodTitle(): PeriodTitles | null {
    return (
      this.match.period_titles.find(
        (item) => this.match.ingame_status === item.status_id
      ) || null
    );
  }

  // Nächster Spielabschnitt. Vor dem Anpfiff ist `ingame_status` leer, findIndex
  // liefert dann -1 und damit bewusst den ersten Abschnitt – darauf baut
  // startOrEndGame() beim Spielstart auf.
  public nextPeriodTitle(): PeriodTitles | null {
    const index = this.match.period_titles.findIndex(
      (item) => this.match.ingame_status === item.status_id
    );
    return this.match.period_titles[index + 1] || null;
  }

  // Steht es unentschieden? Nutzt dieselbe Torquelle wie submitEvent().
  public scoreLevel(): boolean {
    return (
      (this.match.result?.home_goals || 0) ===
      (this.match.result?.guest_goals || 0)
    );
  }

  // Führt der nächste Spielabschnitt in die Verlängerung oder das
  // Penalty-Schießen? Die gesamte Kette (Pause vor Verlängerung,
  // Verlängerung, Pause vor Penalty-Schießen, Penalty-Schießen) ist in
  // League#period_titles als `optional` markiert, die reguläre Spielzeit
  // nicht. Nur so wird auch der erste Schritt (pause_et) erfasst.
  public advanceLeadsToOvertime(): boolean {
    return this.nextPeriodTitle()?.optional === true;
  }

  // Darf in die Verlängerung/das Penalty-Schießen gewechselt werden?
  public advanceAllowed(): boolean {
    return !this.advanceLeadsToOvertime() || this.scoreLevel();
  }

  // Fiel die Entscheidung in Verlängerung oder Penalty-Schießen? Die Pause vor
  // der Verlängerung zählt nicht dazu: dort ist noch keine Verlängerung
  // gespielt, das Spiel endet in regulärer Spielzeit.
  private decidedInOvertime(): boolean {
    const current = this.currentPeriodTitle();
    return current?.optional === true && current.status_id !== 'pause_et';
  }
}
