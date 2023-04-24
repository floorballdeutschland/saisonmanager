import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import {
  Arena,
  Club,
  Game,
  GamedayWithGames,
  GameInput,
  Team,
} from '@floorball/types';
import { GameService, NotificationService } from '@floorball/core';

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
  allGameDays?: GamedayWithGames[];

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
  hasGameDependencies = false;
  processing = false;

  constructor(
    private _gameService: GameService,
    private _notificationService: NotificationService,
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
      this.game.forfait = this.existingGame.forfait;
      this.game.start_time = this.existingGame.start_time;
      this.game.home_team_id = this.existingGame.home_team_id;
      this.game.guest_team_id = this.existingGame.guest_team_id;
      this.game.nominated_referee_string = this.existingGame.nominated_referees;
      this.game.notice_type = this.existingGame.notice_type;
      this.game.notice_string = this.existingGame.notice_string;

      this.hasNotice = !(
        this.game.notice_type === '' || this.game.notice_type === null
      );

      this.game.group_identifier = this.existingGame.group_identifier;
      this.game.title = this.existingGame.title;
      this.game.home_team_filling_rule =
        this.existingGame.home_team_filling_rule;
      this.game.home_team_filling_parameter =
        this.existingGame.home_team_filling_parameter;
      this.game.guest_team_filling_rule =
        this.existingGame.guest_team_filling_rule;
      this.game.guest_team_filling_parameter =
        this.existingGame.guest_team_filling_parameter;

      this.hasGameDependencies = !(
        this.game.title === null &&
        this.game.group_identifier === null &&
        this.game.home_team_filling_rule === null &&
        this.game.home_team_filling_parameter === null &&
        this.game.guest_team_filling_rule === null &&
        this.game.guest_team_filling_parameter === null
      );
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
      forfait: 0,
      nominated_referee_string: '',
      notice_type: '',
      notice_string: '',
      group_identifier: null,
      title: null,
      home_team_filling_rule: null,
      home_team_filling_parameter: null,
      guest_team_filling_rule: null,
      guest_team_filling_parameter: null,
    };

    this._cdr.markForCheck();
  }

  public hasChanges() {
    if (!this.existingGame) {
      return false;
    }

    return (
      this.game.forfait !== this.existingGame.forfait ||
      this.game.game_number !== this.existingGame.game_number ||
      this.game.start_time !== this.existingGame.start_time ||
      this.game.home_team_id !== this.existingGame.home_team_id ||
      this.game.guest_team_id !== this.existingGame.guest_team_id ||
      this.game.notice_type !== this.existingGame.notice_type ||
      this.game.notice_string !== this.existingGame.notice_string ||
      this.game.nominated_referee_string !==
        this.existingGame.nominated_referees ||
      this.game.group_identifier !== this.existingGame.group_identifier ||
      this.game.title !== this.existingGame.title ||
      this.game.home_team_filling_rule !==
        this.existingGame.home_team_filling_rule ||
      this.game.home_team_filling_parameter !==
        this.existingGame.home_team_filling_parameter ||
      this.game.guest_team_filling_rule !==
        this.existingGame.guest_team_filling_rule ||
      this.game.guest_team_filling_parameter !==
        this.existingGame.guest_team_filling_parameter
    );
  }

  public createGame() {
    this.processing = true;
    this._cdr.markForCheck();

    const game = { ...this.game, game_day_id: this.gameDayId };
    delete game.id;

    this._gameService.createGame(game).subscribe({
      next: () => {
        this.refreshSchedule.emit();
        this._notificationService.success('Spiel erfolgreich erstellt', {
          autoClose: true,
          keepAfterRouteChange: true,
        });
      },
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
      next: () => {
        this.refreshSchedule.emit();
        this._notificationService.success('Spiel erfolgreich gespeichert', {
          autoClose: true,
          keepAfterRouteChange: true,
        });
      },
      error: () => {
        this.processing = false;
        this._cdr.markForCheck();
      },
    });
  }

  public deleteGame() {
    this.processing = true;
    this._cdr.markForCheck();

    this._gameService.deleteGame(this.game).subscribe({
      next: () => {
        this.refreshSchedule.emit();
        this._notificationService.success('Spiel erfolgreich gelöscht', {
          autoClose: true,
          keepAfterRouteChange: true,
        });
      },
      error: () => {
        this.processing = false;
        this._cdr.markForCheck();
      },
    });
  }

  public setRatingMode(ratingString: string) {
    this.processing = true;
    let message = '';
    switch (ratingString) {
      case 'forfait-home':
        this.game.forfait = 1;
        message = 'Forfait Heim gespeichert';
        break;
      case 'forfait-guest':
        this.game.forfait = 2;
        message = 'Forfait Gast gespeichert';
        break;
      case 'forfait-both':
        this.game.forfait = 3;
        message = 'Forfait beide gespeichert';
        break;
      default:
        this.game.forfait = 0;
        message = 'Reguläre-Wertung gespeichert';
        break;
    }

    this._gameService
      .setGameFlags(this.existingGame?.id || 0, {
        started: this.game.forfait > 0,
        ended: this.game.forfait > 0,
      })
      .subscribe({
        next: () => {
          this._gameService
            .updateGameRating(this.game.id || 0, this.game.forfait || 0)
            .subscribe({
              next: () => {
                this.refreshSchedule.emit();
                this._notificationService.success(message, {
                  autoClose: true,
                  keepAfterRouteChange: true,
                });
              },
              error: () => {
                this.processing = false;
                this._cdr.markForCheck();
              },
            });
        },
      });
  }

  public toggleNotice() {
    if (this.hasNotice) {
      this.game.notice_type = null;
      this.game.notice_string = null;
    }

    this.hasNotice = !this.hasNotice;
  }

  public toggleGameDependencies() {
    if (this.hasGameDependencies) {
      this.game.group_identifier = null;
      this.game.title = null;
      this.game.home_team_filling_rule = null;
      this.game.home_team_filling_parameter = null;
      this.game.guest_team_filling_rule = null;
      this.game.guest_team_filling_parameter = null;
    }

    this.hasGameDependencies = !this.hasGameDependencies;

    this._cdr.markForCheck();
  }
}
