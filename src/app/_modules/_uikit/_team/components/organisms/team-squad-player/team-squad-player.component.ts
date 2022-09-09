import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { GamePlayerEntry, PlayerWithLicense } from '@floorball/types';
import { GameService, NotificationService } from '@floorball/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'fb-team-squad-player',
  templateUrl: './team-squad-player.component.html',
  styleUrls: ['./team-squad-player.component.scss'],
})
export class TeamSquadPlayerComponent implements OnInit {
  @Input() side!: string;
  @Input() player!: PlayerWithLicense;
  @Input() gamePlayerEntry!: GamePlayerEntry | null;
  @Input() captainPlayerId!: number | null;
  @Output() updateLineup: EventEmitter<GamePlayerEntry[]> = new EventEmitter<
    GamePlayerEntry[]
  >();
  @Output() setCaptainPlayerId: EventEmitter<number | null> = new EventEmitter<
    number | null
  >();

  gameId?: number;
  trikotNumber?: string;
  checked = false;
  changed = false;
  goalkeeper = false;

  constructor(
    private _gameService: GameService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef,
    private _notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    if (this.gamePlayerEntry) {
      this.trikotNumber = this.gamePlayerEntry.trikot_number
        ? this.gamePlayerEntry.trikot_number.toString()
        : '';
      this.goalkeeper = this.gamePlayerEntry.goalkeeper || false;
      this.checked = true;
    }

    this._route.params.subscribe({
      next: (value) => {
        this.gameId = value['matchId'];
      },
    });
  }

  handleButtonClick() {
    if (!this.gamePlayerEntry) {
      console.log('click');
      this.addLinupPlayer();
    } else if (this.changed) {
      this.updateLinupPlayer();
    } else {
      this.removeLinupPlayer();
    }
  }

  public addLinupPlayer() {
    console.log(this.trikotNumber);
    if (this.trikotNumber && this.gameId) {
      this._gameService
        .addLineupPlayerToGame(
          this.gameId,
          this.side,
          this.player.id,
          this.trikotNumber,
          this.goalkeeper
        )
        .subscribe({
          next: (result) => {
            this.updateLineup.emit(result);
          },
        });
    } else {
      this._notificationService.error('Bitte gib eine Trikotnummer an', {
        autoClose: true,
        keepAfterRouteChange: false,
      });
    }
  }

  public updateLinupPlayer() {
    if (this.gamePlayerEntry?.trikot_number && this.gameId) {
      this._gameService
        .removeLineupPlayerToGame(
          this.gameId,
          this.side,
          this.gamePlayerEntry?.trikot_number.toString()
        )
        .subscribe(() => this.addLinupPlayer());
    } else {
      this._notificationService.error('Bitte gib eine Trikotnummer an', {
        autoClose: true,
        keepAfterRouteChange: false,
      });
    }
  }

  public removeLinupPlayer() {
    if (this.trikotNumber && this.gameId) {
      this._gameService
        .removeLineupPlayerToGame(this.gameId, this.side, this.trikotNumber)
        .subscribe({
          next: (result) => {
            this.updateLineup.emit(result);
          },
        });
    } else {
      this._notificationService.error('Bitte gib eine Trikotnummer an', {
        autoClose: true,
        keepAfterRouteChange: false,
      });
    }
  }

  handleTrikotNumberChange() {
    if (
      this.gamePlayerEntry &&
      this.gamePlayerEntry.trikot_number.toString() !== this.trikotNumber
    ) {
      console.log('tiko');
      this.updateLinupPlayer();
    } else {
      this.addLinupPlayer();
    }
  }

  toggleGoalkeeper() {
    this.goalkeeper = !this.goalkeeper;

    if (this.gamePlayerEntry) {
      if (this.gamePlayerEntry.goalkeeper !== this.goalkeeper) {
        this.updateLinupPlayer();
      } else {
        this.checked = true;
        this.changed = false;
      }
    }
  }

  toggleCaptain() {
    const value =
      this.captainPlayerId === this.player.id ? null : this.player.id;
    this.setCaptainPlayerId.emit(value);
  }
}
