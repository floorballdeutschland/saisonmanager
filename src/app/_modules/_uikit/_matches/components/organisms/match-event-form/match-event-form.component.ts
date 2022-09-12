import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import {
  AssociationService,
  ClubService,
  GameService,
  NotificationService,
  RefereeService,
} from '@floorball/core';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import {
  Game,
  GameFlags,
  GameFields,
  Penalty,
  PenaltyCode,
} from '@floorball/types';

@Component({
  selector: 'fb-match-event-form',
  templateUrl: './match-event-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class MatchEventFormComponent implements OnInit {
  @Input()
  fieldValue?: string;

  @Input()
  fieldChecked? = false;

  @Input()
  type!: string;

  @Input()
  team!: string;

  @Input()
  match!: Game;

  @Input()
  penalties!: Penalty[];

  @Input()
  penaltyCodes!: PenaltyCode[];

  @Output()
  updateGame: EventEmitter<void> = new EventEmitter<void>();

  period = '';
  editLive = true;
  startTime = '';
  minutes?: number;
  seconds?: number;
  playerId?: number;
  assistPlayerId?: number;
  penalty?: number;
  penaltyCode?: number;

  visitors?: number;
  recordkeeper?: string;
  recordkeeperFirstname?: string;
  recordkeeperLastname?: string;
  timekeeperFirstname?: string;
  timekeeperLastname?: string;
  refereeNumber1?: number;
  refereeName1?: string;
  refereeNumber2?: number;
  refereeName2?: string;

  protest?: boolean;
  specialevent?: boolean;

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
      this.refereeNumber1 = parseInt(this.match.referees[0]?.license_id, 10);
      this.refereeName1 =
        this.match.referees[0]?.last_name +
        ', ' +
        this.match.referees[0]?.first_name;
    }

    if (this.type === 'referee2') {
      this.refereeNumber2 = parseInt(this.match.referees[1]?.license_id, 10);
      this.refereeName2 =
        this.match.referees[1]?.last_name +
        ', ' +
        this.match.referees[1]?.first_name;
    }

    if (this.fieldValue) {
      switch (this.type) {
        case 'visitors':
          this.visitors = parseInt(this.fieldValue || '', 10);
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

    let player;
    if (this.team === 'home') {
      player =
        this.match.players.home.find(
          (p: { player_id: number | undefined }) => p.player_id == this.playerId
        )?.trikot_number || 0;
    } else {
      player =
        this.match.players.guest.find(
          (p: { player_id: number | undefined }) => p.player_id == this.playerId
        )?.trikot_number || 0;
    }

    switch (this.type) {
      case 'next':
        const gameFlag = !this.match.started ? 'started' : 'ended';
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
                  start_time: this.editLive
                    ? `${hours}:${this.pad(minutes, 2)}`
                    : this.startTime,
                })
                .subscribe();
            }

            this._notificationService.success(
              !this.match.started ? 'Spiel gestartet' : 'Spiel beendet',
              {
                autoClose: true,
                keepAfterRouteChange: true,
              }
            );
            this.updateGame.emit();
          });
        break;
      case 'goal':
        if (this.period) {
          let assist;
          if (this.team === 'home') {
            assist =
              this.match.players.home.find(
                (p: { player_id: number | undefined }) =>
                  p.player_id == this.assistPlayerId
              )?.trikot_number || 0;
          } else {
            assist =
              this.match.players.guest.find(
                (p: { player_id: number | undefined }) =>
                  p.player_id == this.assistPlayerId
              )?.trikot_number || 0;
          }

          const goal =
            this.team === 'home'
              ? { home_number: player, home_assist: assist }
              : { guest_number: player, guest_assist: assist };

          this._gameService
            .addEvent(this.match.id, {
              time,
              event_type: 'goal',
              period: parseInt(this.period, 10),
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
        if (this.period) {
          this._gameService
            .addEvent(this.match.id, {
              time,
              event_type: 'penalty',
              period: parseInt(this.period, 10),
              home_goals,
              guest_goals,
              [this.team === 'home' ? 'home_number' : 'guest_number']: player,
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
            [field]: `${time} / ${this.period}`,
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
                this.refereeName1 = `${referee.lastname}, ${referee.firstname}`;
                this._notificationService.error(
                  'Schiedsrichter nicht gefunden',
                  {
                    autoClose: true,
                    keepAfterRouteChange: true,
                  }
                );
                this._cdr.markForCheck();
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
                this.refereeName2 = `${referee.lastname}, ${referee.firstname}`;
                this._cdr.markForCheck();
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
      case 'visitors':
        fields = { audience: this.visitors?.toString() || '' };
        saveMessage = 'Zuschauerzahl gespeichert';
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
        if (this.refereeNumber1) {
          this._gameService
            .setReferee(
              this.match.id,
              1,
              this.refereeNumber1 || 0,
              this.refereeName1 || ''
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
        }
        break;
      case 'referee2':
        if (this.refereeNumber1) {
          this._gameService
            .setReferee(
              this.match.id,
              2,
              this.refereeNumber2 || 0,
              this.refereeName2 || ''
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
        }
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
}
