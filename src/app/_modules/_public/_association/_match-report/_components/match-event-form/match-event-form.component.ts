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
  getPeriodTimeRange,
  isEventTimeInRange,
  PeriodTimeRange,
} from './event-time-validation';

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

  playerSearchNumber?: number;
  playerNumber = 0;
  assistError = false;
  assistPlayerSearchNumber?: number;
  assistPlayerNumber = 0;
  playerError = false;
  penalty = 0;
  penaltyCode = 0;
  with_ps?: boolean;

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
          const recordKeeperName = this.fieldValue.split(', ');
          this.recordkeeperLastname = recordKeeperName[0];
          this.recordkeeperFirstname = recordKeeperName[1];
          break;
        case 'timekeeper':
          const timekeeperName = this.fieldValue.split(', ');
          this.timekeeperLastname = timekeeperName[0];
          this.timekeeperFirstname = timekeeperName[1];
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

      this.playerNumber = e.number ?? 0;
      this.assistPlayerNumber = e.assist ?? 0;

      if (e.event_type === 'penalty') {
        this.penalty = e.penalty_id ?? 0;
        this.penaltyCode = e.penalty_code_id ?? 0;
      } else if (e.event_type === 'goal') {
        this.penaltyCode = e.penalty_code_id ?? 0;
        this.with_ps = e.goal_type === 'penalty_shot';
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
    if (number >= 2001 && number <= 2005 && !isAssist) {
      this.playerNumber = number;
      this.playerError = false;
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

  public submitDisabled(): boolean {
    return (
      (!this.editLive && this.startTime === '') ||
      (['penalty'].includes(this.type) &&
        (!this.penaltyCode || !this.penalty)) ||
      (['goal', 'penalty'].includes(this.type) && !this.playerNumber) ||
      (['goal', 'penalty', 'timeout'].includes(this.type) &&
        (!this.minutesValid || !this.secondsValid || this.timeOutOfRange()))
    );
  }

  private eventPeriod(): number {
    return parseInt(
      this.currentPeriod || this.existingEvent?.period?.toString() || '',
      10
    );
  }

  public periodTimeRange(): PeriodTimeRange | null {
    return getPeriodTimeRange(this.league, this.eventPeriod());
  }

  public timeOutOfRange(): boolean {
    if (this.minutes === undefined || this.minutes === null) {
      return false;
    }
    return !isEventTimeInRange(
      this.periodTimeRange(),
      this.minutes,
      this.seconds ?? 0
    );
  }

  public timeRangeErrorText(): string {
    const range = this.periodTimeRange();
    if (!range) {
      return 'Ungültige Zeitangabe.';
    }
    return (
      'Die Zeit liegt außerhalb des gewählten Spielabschnitts ' +
      `(erlaubt: ${formatSecondsAsGameTime(range.startSeconds)} bis ` +
      `${formatSecondsAsGameTime(range.endSeconds)}).`
    );
  }

  public startOrEndGame(startGame: boolean) {
    const gameFlag = startGame ? 'started' : 'ended';

    this._gameService
      .setGameFlags(this.match.id, {
        [gameFlag]: true,
        ...(!startGame
          ? { overtime: this.match.current_period_title.optional }
          : {}),
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
        error: (err) => {
          // Der ErrorInterceptor zeigt bei 422 keinen Toast und wirft die
          // Meldung als String. Blockier-Meldungen beim Spielstart/-ende
          // (z. B. Schiri-Pflicht oder fehlende Aufstellung) hier anzeigen.
          this._notificationService.error(
            typeof err === 'string' ? err : 'Aktion nicht möglich.',
            { autoClose: false, keepAfterRouteChange: false }
          );
        },
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

          if (this.with_ps) {
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
          record_keeper_string: `${this.recordkeeperLastname?.replace(
            ',',
            ''
          )}, ${this.recordkeeperFirstname?.replace(',', '')}`,
        };
        saveMessage = 'Schriftführer/in gespeichert';
        break;
      case 'timekeeper':
        fields = {
          time_keeper_string: `${this.timekeeperLastname?.replace(
            ',',
            ''
          )}, ${this.timekeeperFirstname?.replace(',', '')}`,
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

  public nextPeriodTitle(): PeriodTitles | null {
    const index =
      this.match.period_titles.findIndex(
        (item) => this.match.ingame_status === item.status_id
      ) || 0;
    return this.match.period_titles[index + 1] || null;
  }
}
