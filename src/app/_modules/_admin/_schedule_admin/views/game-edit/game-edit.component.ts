import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  Arena,
  Club,
  Game,
  GamedayWithGames,
  GameInput,
  Team,
} from '@floorball/types';
import {
  GameSchedulingConflict,
  GameService,
  NotificationService,
} from '@floorball/core';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'fb-game-edit',
  templateUrl: './game-edit.component.html',
  styleUrls: ['./game-edit.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
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

  static readonly RSK_ASSIGNMENT = 'Ansetzung durch RSK';

  game!: GameInput;
  hasNotice = false;
  hasGameDependencies = false;
  hasMoveGameDay = false;
  processing = false;
  conflicts: GameSchedulingConflict[] = [];

  get isRskAssignment(): boolean {
    return (
      this.game?.nominated_referee_string === GameEditComponent.RSK_ASSIGNMENT
    );
  }

  toggleRskAssignment(): void {
    this.game.nominated_referee_string = this.isRskAssignment
      ? ''
      : GameEditComponent.RSK_ASSIGNMENT;
    this._cdr.markForCheck();
  }

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
      this.game.game_day_id = this.gameDayId;
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
      this.game.series_title = this.existingGame.series_title;
      this.game.series_number = this.existingGame.series_number;
      this.game.home_team_filling_rule =
        this.existingGame.home_team_filling_rule;
      this.game.home_team_filling_parameter =
        this.existingGame.home_team_filling_parameter;
      this.game.guest_team_filling_rule =
        this.existingGame.guest_team_filling_rule;
      this.game.guest_team_filling_parameter =
        this.existingGame.guest_team_filling_parameter;

      this.hasGameDependencies = !(
        this.game.series_title === null &&
        this.game.series_number === null &&
        this.game.group_identifier === null &&
        this.game.home_team_filling_rule === null &&
        this.game.home_team_filling_parameter === null &&
        this.game.guest_team_filling_rule === null &&
        this.game.guest_team_filling_parameter === null
      );
    }

    this.hasMoveGameDay = false;
    this.processing = false;
    // Alte Konfliktwarnung verwerfen, damit sie nach erfolgreichem Speichern/
    // Zurücksetzen nicht fälschlich stehen bleibt.
    this.conflicts = [];
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
      series_title: null,
      series_number: null,
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
      this.game.game_day_id !== this.gameDayId ||
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
      this.game.series_title !== this.existingGame.series_title ||
      this.game.series_number !== this.existingGame.series_number ||
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

    const gameDayChanged = this.game.game_day_id !== this.gameDayId;

    this._gameService.updateGame(this.game).subscribe({
      next: () => {
        this._notificationService.success('Spiel erfolgreich gespeichert', {
          autoClose: true,
          keepAfterRouteChange: true,
        });
        if (gameDayChanged) {
          this.refreshSchedule.emit();
        } else {
          // Update existingGame in place so other rows keep their pending changes
          Object.assign(this.existingGame!, {
            game_number: this.game.game_number,
            forfait: this.game.forfait,
            start_time: this.game.start_time,
            home_team_id: this.game.home_team_id,
            guest_team_id: this.game.guest_team_id,
            nominated_referees: this.game.nominated_referee_string,
            notice_type: this.game.notice_type,
            notice_string: this.game.notice_string,
            group_identifier: this.game.group_identifier,
            series_title: this.game.series_title,
            series_number: this.game.series_number,
            home_team_filling_rule: this.game.home_team_filling_rule,
            home_team_filling_parameter: this.game.home_team_filling_parameter,
            guest_team_filling_rule: this.game.guest_team_filling_rule,
            guest_team_filling_parameter:
              this.game.guest_team_filling_parameter,
          });
          this.resetGame();
        }
      },
      error: () => {
        this.processing = false;
        this.hasMoveGameDay = false;
        this.game.game_day_id = this.gameDayId;
        this._notificationService.error(
          'Spiel konnte nicht gespeichert werden',
          { autoClose: false }
        );
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
      .pipe(
        switchMap(() =>
          this._gameService.updateGameRating(
            this.game.id || 0,
            this.game.forfait || 0
          )
        )
      )
      .subscribe({
        next: () => {
          this.processing = false;
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
  }

  // Nicht-blockierende Hallenbelegungs-Prüfung: warnt, wenn ein anderes Spiel in
  // derselben Halle am selben Tag zeitlich kollidiert. Speichern bleibt erlaubt.
  public checkConflicts() {
    const gameDayId = this.game.game_day_id || this.gameDayId;
    if (!this.game.start_time || !gameDayId) {
      this.conflicts = [];
      this._cdr.markForCheck();
      return;
    }

    this._gameService
      .getSchedulingConflicts({
        gameDayId,
        startTime: this.game.start_time,
        gameId: this.game.id,
      })
      .subscribe({
        next: (result) => {
          this.conflicts = result.conflicts;
          this._cdr.markForCheck();
        },
        error: () => {
          // Konfliktprüfung ist optional; Fehler nicht aufdringlich melden.
          this.conflicts = [];
          this._cdr.markForCheck();
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

  public toggleMoveGameDay() {
    this.hasMoveGameDay = !this.hasMoveGameDay;
    if (!this.hasMoveGameDay) {
      this.game.game_day_id = this.gameDayId;
    }
    this._cdr.markForCheck();
  }

  public toggleGameDependencies() {
    if (this.hasGameDependencies) {
      this.game.group_identifier = null;
      this.game.home_team_filling_rule = null;
      this.game.home_team_filling_parameter = null;
      this.game.guest_team_filling_rule = null;
      this.game.guest_team_filling_parameter = null;
    }

    this.hasGameDependencies = !this.hasGameDependencies;

    this._cdr.markForCheck();
  }
}
