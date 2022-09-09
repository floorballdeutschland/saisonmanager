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

@Component({
  selector: 'fb-team-squad-player',
  templateUrl: './team-squad-player.component.html',
  styleUrls: ['./team-squad-player.component.scss'],
})
export class TeamSquadPlayerComponent implements OnInit {
  @Input() player!: PlayerWithLicense;
  @Input() gamePlayerEntry!: GamePlayerEntry | null;
  @Input() captainPlayerId!: number | null;
  @Output() updateLineup: EventEmitter<GamePlayerEntry[]> = new EventEmitter<
    GamePlayerEntry[]
  >();
  @Output() setCaptainPlayerId: EventEmitter<number | null> = new EventEmitter<
    number | null
  >();

  trikotNumber?: number;
  checked = false;
  changed = false;
  goalkeeper = false;

  constructor(
    private _gameService: GameService,
    private _cdr: ChangeDetectorRef,
    private _notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    if (this.gamePlayerEntry) {
      this.trikotNumber = this.gamePlayerEntry.trikot_number;
      this.goalkeeper = this.gamePlayerEntry.goalkeeper || false;
      this.checked = true;
    }
  }

  handleButtonClick() {
    if (this.trikotNumber) {
      console.log(this.trikotNumber);
      this._gameService
        .addLineupPlayerToGame(
          12,
          'home',
          this.player.id,
          this.trikotNumber,
          this.goalkeeper
        )
        .subscribe({
          next: (result) => {
            console.log(result);
          },
        });
      this.updateLineup.emit([]);
    } else {
      this._notificationService.error('Bitte gib eine Trikotnummer an', {
        autoClose: true,
        keepAfterRouteChange: false,
      });
    }

    console.log(this.checked);

    this._cdr.markForCheck();
  }

  handleTrikotNumberChange() {
    console.log('trikot');
    if (this.gamePlayerEntry) {
      if (this.gamePlayerEntry.trikot_number !== this.trikotNumber) {
        this.checked = false;
        this.changed = true;
      } else {
        this.checked = true;
        this.changed = false;
      }
    }
  }

  toggleGoalkeeper() {
    console.log('goal');
    this.goalkeeper = !this.goalkeeper;

    if (this.gamePlayerEntry) {
      if (this.gamePlayerEntry.goalkeeper !== this.goalkeeper) {
        this.checked = false;
        this.changed = true;
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
