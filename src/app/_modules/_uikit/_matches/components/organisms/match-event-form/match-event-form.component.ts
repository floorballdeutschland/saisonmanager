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
} from '@floorball/core';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Game, GameFields, Penalty } from '@floorball/types';
import { PenaltyCode } from '../../../../../../_models/penalty-code.interface';
import { GameFlags } from '../../../../../../_models/game-flags.interface';

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
  minutes?: number;
  seconds?: number;
  playerId?: number;
  assistPlayerId?: number;
  penalty?: number;
  penaltyCode?: number;

  visitors?: number;
  recordkeeper?: string;
  timekeeper?: string;
  refereeNumber1?: number;
  refereeNumber2?: number;

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
    private _route: ActivatedRoute,
    private _notificationService: NotificationService,
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title
  ) {}

  public ngOnInit(): void {
    console.log(this.match);

    if (this.fieldValue) {
      switch (this.type) {
        case 'visitors':
          this.visitors = parseInt(this.fieldValue || '', 10);
          break;
        case 'recordkeeper':
          break;
        case 'timekeeper':
          break;
        case 'referee1':
          this.refereeNumber1 = parseInt(this.fieldValue || '', 10);
          break;
        case 'referee2':
          this.refereeNumber2 = parseInt(this.fieldValue || '', 10);
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
            this._notificationService.success(
              !this.match.started ? 'Spiel gestartet' : 'Spiel beendet',
              {
                autoClose: true,
                keepAfterRouteChange: true,
              }
            );
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
        // this._gameService.addEvent({
        //   time,
        //   event_type,
        //   period,
        //   home_goals,
        //   guest_goals,
        //   home_number,
        //   home_assist,
        //   guest_number,
        //   guest_assist,
        //   penalty_id,
        //   penalty_code_id,
        //   goal_type,
        // })
        break;
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
        fields = { record_keeper_string: this.recordkeeper };
        saveMessage = 'Schriftführer/in gespeichert';
        break;
      case 'timekeeper':
        fields = { time_keeper_string: this.timekeeper };
        saveMessage = 'Zeitnehmer/in gespeichert';
        break;
      case 'referee1':
        saveMessage = 'Schiedsrichter 1 gespeichert';
        break;
      case 'referee2':
        saveMessage = 'Schiedsrichter 2 gespeichert';
        break;
    }

    if (Object.keys(fields).length) {
      this._gameService.setGameField(this.match.id, fields).subscribe({
        next: (result) => {
          this._notificationService.success(saveMessage, {
            autoClose: true,
            keepAfterRouteChange: true,
          });
        },
      });
    }
  }

  public submitFlag() {
    let flags: GameFlags = {};
    switch (this.type) {
      case 'timekeepersigned':
        flags = { time_keeper_signed: this.timekeepersigned };
        break;
      case 'recordkeepersigned':
        flags = { record_keeper_signed: this.recordkeepersigned };
        break;
      case 'referee1signed':
        flags = { referee1_signed: this.referee1signed };
        break;
      case 'referee2signed':
        flags = { referee2_signed: this.referee2signed };
        break;
      case 'captainsigned':
        console.log(
          this.captainsignedhome,
          this.captainsignedvisitor,
          this.team
        );
        if (this.team === 'home') {
          flags = { home_captain_signed: this.captainsignedhome };
        } else {
          flags = { guest_captain_signed: this.captainsignedvisitor };
        }
        break;
    }

    if (Object.keys(flags).length) {
      this._gameService.setGameFlags(this.match.id, flags).subscribe({
        next: (result) => {
          console.log(result);
        },
      });
    }
  }
}
