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
} from '@angular/core';
import {
  Game,
  GameAdditionalFields,
  GameFields,
  GameFlags,
  Penalty,
  PenaltyCode,
  PeriodTitles,
} from '@floorball/types';
import {
  AssociationService,
  ClubService,
  GameService,
  NotificationService,
  RefereeService,
} from '@floorball/core';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'fb-match-event-form',
  templateUrl: './match-event-form.component.html',
  styleUrls: ['./match-event-form.component.scss'],
})
export class MatchEventFormComponent implements OnInit, AfterViewInit {
  @ViewChild('minutefield')
  minutefieldElement!: ElementRef<HTMLInputElement>;

  @ViewChild('secondsfield')
  secondsfieldElement!: ElementRef<HTMLInputElement>;

  @ViewChild('playerSearchField')
  playerSearchFieldElement!: ElementRef<HTMLInputElement>;

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
  additionalFields!: GameAdditionalFields;

  @Input()
  penalties!: Penalty[];

  @Input()
  penaltyCodes!: PenaltyCode[];

  @Input()
  noBackground = false;

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
  recordkeeper?: string;
  recordkeeperFirstname?: string;
  recordkeeperLastname?: string;
  timekeeperFirstname?: string;
  timekeeperLastname?: string;
  refereeNumber1?: number | '';
  refereeLastname1?: string;
  refereeFirstname1?: string;
  refereeNumber2?: number | '';
  refereeLastname2?: string;
  refereeFirstname2?: string;

  protest?: boolean;
  specialevent?: boolean;
  overtime?: boolean;

  timekeepersigned?: boolean;
  recordkeepersigned?: boolean;
  referee1signed?: boolean;
  referee2signed?: boolean;
  captainsignedhome?: boolean;
  captainsignedvisitor?: boolean;

  constructor(
    private _associationService: AssociationService,
    private _gameService: GameService,
    private _clubService: ClubService,
    private _refereeService: RefereeService,
    private _route: ActivatedRoute,
    private _notificationService: NotificationService,
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title
  ) {}

  public ngOnInit(): void {
    if (this.type === 'referee1') {
      this.refereeNumber1 =
        parseInt(this.match.referees[0]?.license_id, 10) || '';
      this.refereeLastname1 = this.match.referees[0]?.last_name;
      this.refereeFirstname1 = this.match.referees[0]?.first_name;
    }

    if (this.type === 'referee2') {
      this.refereeNumber2 =
        parseInt(this.match.referees[1]?.license_id, 10) || '';
      this.refereeLastname2 = this.match.referees[1]?.last_name;
      this.refereeFirstname2 = this.match.referees[1]?.first_name;
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
        case 'comment':
          this.comment = this.fieldValue || '';
          break;
        case 'visitors':
          this.visitors = parseInt(this.fieldValue || '', 10);
          break;
        case 'livestream':
          this.livestream = this.fieldValue;
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
          this.overtime =
            this.fieldChecked || this.match.current_period_title.optional;
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

    if (this.type === 'overtime') {
      this.overtime = this.overtime || this.match.current_period_title.optional;
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

  public searchPlayerByNumber(side: string, number: number, isAssist: boolean) {
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
  }

  public submitDisabled(): boolean {
    return (
      (!this.editLive && this.startTime === '') ||
      (['penalty'].includes(this.type) &&
        (!this.penaltyCode || !this.penalty)) ||
      (['goal', 'penalty'].includes(this.type) && !this.playerNumber) ||
      (['goal', 'penalty', 'timeout'].includes(this.type) &&
        (!this.minutesValid || !this.secondsValid))
    );
  }

  public startOrEndGame(startGame: boolean) {
    const gameFlag = startGame ? 'started' : 'ended';

    this._gameService
      .setGameFlags(this.match.id, {
        [gameFlag]: true,
      })
      .subscribe(() => {
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
        if (this.currentPeriod) {
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

          this._gameService
            .addEvent(this.match.id, {
              time,
              event_type: 'goal',
              event_team: this.team,
              period: parseInt(this.currentPeriod, 10),
              home_goals,
              guest_goals,
              ...goal,
            })
            .subscribe(() => {
              this.updateGame.emit();
              this._notificationService.success('Tor hinzugefügt', {
                autoClose: true,
                keepAfterRouteChange: true,
              });
            });
        }
        break;
      case 'penalty':
        if (this.currentPeriod) {
          this._gameService
            .addEvent(this.match.id, {
              time,
              event_type: 'penalty',
              event_team: this.team,
              period: parseInt(this.currentPeriod, 10),
              home_goals,
              guest_goals,
              [this.team === 'home' ? 'home_number' : 'guest_number']: parseInt(
                this.playerNumber.toString(),
                10
              ),
              penalty_id: this.penalty,
              penalty_code_id: this.penaltyCode,
            })
            .subscribe(() => {
              this._notificationService.success('Tor hinzugefügt', {
                autoClose: true,
                keepAfterRouteChange: true,
              });
              this.updateGame.emit();
            });
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

  public getRefereeInfos() {
    if (this.type === 'referee1') {
      if (this.refereeNumber1) {
        this._refereeService
          .getRefereeByLicenseNumber(this.refereeNumber1)
          .subscribe({
            next: (referee) => {
              if (referee) {
                this.refereeLastname1 = referee.lastname;
                this.refereeFirstname1 = referee.firstname;
                this._cdr.markForCheck();
              } else {
                this._notificationService.error(
                  'Schiedsrichter nicht gefunden',
                  {
                    autoClose: true,
                    keepAfterRouteChange: true,
                  }
                );
              }
            },
          });
      }
    } else {
      if (this.refereeNumber2) {
        this._refereeService
          .getRefereeByLicenseNumber(this.refereeNumber2)
          .subscribe({
            next: (referee) => {
              if (referee) {
                this.refereeLastname2 = referee.lastname;
                this.refereeFirstname2 = referee.firstname;
                this._cdr.markForCheck();
              } else {
                this._notificationService.error(
                  'Schiedsrichter nicht gefunden',
                  {
                    autoClose: true,
                    keepAfterRouteChange: true,
                  }
                );
              }
            },
          });
      }
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
            this.refereeNumber1 || 0,
            this.refereeLastname1 || '',
            this.refereeFirstname1 || ''
          )
          .subscribe({
            next: () => {
              this._notificationService.success(saveMessage, {
                autoClose: true,
                keepAfterRouteChange: true,
              });
              this.updateGame.emit();
            },
          });
        saveMessage = 'Schiedsrichter 1 gespeichert';
        break;
      case 'referee2':
        this._gameService
          .setReferee(
            this.match.id,
            2,
            this.refereeNumber2 || 0,
            this.refereeLastname2 || '',
            this.refereeFirstname2 || ''
          )
          .subscribe({
            next: () => {
              this._notificationService.success(saveMessage, {
                autoClose: true,
                keepAfterRouteChange: true,
              });
              this.updateGame.emit();
            },
          });
        saveMessage = 'Schiedsrichter 2 gespeichert';
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
    if ((event.target as HTMLInputElement).value) {
      this.updatePeriod?.emit((event.target as HTMLInputElement).value);
    }
  }

  public onMinutesChange() {
    if (this.minutes && this.minutes.toString().length >= 2) {
      if (this.minutes.toString().length > 2) {
        this.minutes = parseInt(this.minutes.toString().substring(0, 2), 10);
        this._cdr.markForCheck();
      }

      this.secondsfieldElement?.nativeElement?.focus();
    }

    this.minutesValid = this.minutes !== undefined && this.minutes !== null;
  }

  public onSecondsChange() {
    if (this.seconds && this.seconds.toString().length >= 2) {
      if (this.seconds.toString().length > 2) {
        this.seconds = parseInt(this.seconds.toString().substring(0, 2), 10);
        this._cdr.markForCheck();
      }

      this.playerSearchFieldElement?.nativeElement?.focus();
    }

    this.secondsValid = this.seconds !== undefined && this.seconds !== null;
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
