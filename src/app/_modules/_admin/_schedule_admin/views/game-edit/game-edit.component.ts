import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { Arena, Club, Game, GameInput, Team } from '@floorball/types';
import { GameService } from '@floorball/core';

@Component({
  selector: 'fb-game-edit',
  templateUrl: './game-edit.component.html',
  styleUrls: ['./game-edit.component.scss'],
})
export class GameEditComponent implements OnInit {
  @Input()
  first!: boolean;

  @Input()
  existingGame?: Game;

  @Input()
  teams!: Team[];

  @Input()
  gameDayId!: number;

  @Input()
  clubs!: Club[];

  @Input()
  arenas!: Arena[];

  @Output()
  refreshSchedule = new EventEmitter<void>();

  game!: GameInput;
  hasNotice = false;
  processing = false;

  constructor(
    private _gameService: GameService,
    private _cdr: ChangeDetectorRef
  ) {
    this.newGame();
  }

  ngOnInit(): void {
    if (this.existingGame) {
      this.resetGame();
    }
  }

  public resetGame() {
    if (this.existingGame) {
      this.game.id = this.existingGame.id;
      this.game.game_number = this.existingGame.game_number;
      this.game.start_time = this.existingGame.start_time;
      this.game.home_team_id = this.existingGame.home_team_id;
      this.game.guest_team_id = this.existingGame.guest_team_id;
      this.game.nominated_referee_string = this.existingGame.nominated_referees;
    }

    this.processing = false;
    this._cdr.markForCheck();
  }

  public newGame() {
    this.game = {
      game_day_id: this.gameDayId,
      game_number: '',
      start_time: '',
      home_team_id: 0,
      guest_team_id: 0,
      nominated_referee_string: '',
    };

    this._cdr.markForCheck();
  }

  public hasChanges() {
    if (!this.existingGame) {
      return false;
    }

    return (
      this.game.game_number !== this.existingGame.game_number ||
      this.game.start_time !== this.existingGame.start_time ||
      this.game.home_team_id !== this.existingGame.home_team_id ||
      this.game.guest_team_id !== this.existingGame.guest_team_id ||
      this.game.nominated_referee_string !==
        this.existingGame.nominated_referees
    );
  }

  public createGame() {
    this.processing = true;
    this._cdr.markForCheck();

    const game = { ...this.game };
    delete game.id;

    this._gameService.createGame(game).subscribe({
      next: () => this.refreshSchedule.emit(),
      error: () => {
        this.processing = false;
        this._cdr.markForCheck();
      },
    });
  }

  public updateGame() {
    if (!this.hasChanges()) {
      return;
    }

    this.processing = true;
    this._cdr.markForCheck();

    this._gameService.updateGame(this.game).subscribe({
      next: () => this.refreshSchedule.emit(),
      error: () => {
        this.processing = false;
        this._cdr.markForCheck();
      },
    });
  }
}
