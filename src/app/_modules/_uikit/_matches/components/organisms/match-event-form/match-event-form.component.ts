import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { AssociationService, ClubService, GameService } from '@floorball/core';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Game } from '@floorball/types';

@Component({
  selector: 'fb-match-event-form',
  templateUrl: './match-event-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class MatchEventFormComponent implements OnInit {
  @Input()
  type!: string;

  @Input()
  team!: string;

  @Input()
  match!: Game;

  period = '';
  minutes?: number;
  seconds?: number;
  playerId?: number;
  assistPlayerId?: number;
  penalty?: number;
  penaltyCode?: number;

  constructor(
    private _associationService: AssociationService,
    private _gameService: GameService,
    private _clubService: ClubService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title
  ) {}

  public ngOnInit(): void {
    console.log(this.match);
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
      this.team === 'home'
        ? (this.match.result?.home_goals || 0) + 1
        : this.match.result?.home_goals || 0;
    const guest_goals =
      this.team === 'guest'
        ? (this.match.result?.guest_goals || 0) + 1
        : this.match.result?.guest_goals || 0;

    switch (this.type) {
      case 'goal':
        this._gameService
          .addEvent(this.match.id, {
            time,
            event_type: 'goal',
            period: parseInt(this.period, 10),
            home_goals,
            guest_goals,
          })
          .subscribe((result) => console.log(result));
        break;
      case 'penalty':
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
}
