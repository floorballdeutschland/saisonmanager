import { ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import {
  GameService,
  LeagueService,
  NotificationService,
} from '@floorball/core';
import { Game, StartingPlayerPosition, StartingPlayer } from '@floorball/types';
import { Observable, tap, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'fb-starting-player',
  templateUrl: './starting-player.component.html',
})
export class StartingPlayerComponent implements OnInit {
  startingHome: StartingPlayer[] = [];
  startingGuest: StartingPlayer[] = [];

  fieldSize!: string;

  positions: {
    goal: string;
    defender1: string;
    defender2: string;
    center: string;
    forward1: string;
    forward2: string;
  } = {
    goal: 'Torwart',
    defender1: 'Verteidigung 1',
    defender2: 'Verteidigung 2',
    center: 'Center',
    forward1: 'Angriff 1',
    forward2: 'Angriff 2',
  };

  @Input()
  team!: string;

  @Input()
  match!: Game;

  constructor(
    private _gameService: GameService,
    private _leagueService: LeagueService,
    private _notificationService: NotificationService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._leagueService.selectedLeague$
      .pipe(
        tap((league) => {
          if (league?.id) {
            this.fieldSize = league.field_size;

            this._cdr.markForCheck();
          }
        })
      )
      .subscribe();

    this.presetFromExistingMatch();
  }

  public presetFromExistingMatch() {
    if (this.match.starting_players.home) {
      this.startingHome = [...this.match.starting_players.home] || [];
    }
    if (this.match.starting_players.guest) {
      this.startingGuest = [...this.match.starting_players.guest] || [];
    }

    this._cdr.markForCheck();
  }

  public setStartingPlayer(position: string, player_id: string) {
    this._gameService
      .setStartingPlayer(
        this.match.id,
        this.team,
        parseInt(player_id, 10),
        position as StartingPlayerPosition
      )
      .pipe(
        tap((starting) => {
          console.log(starting);
          this.startingHome = starting.home || [];
          this.startingGuest = starting.guest || [];
          this._cdr.markForCheck();

          console.log(this.startingHome, this.startingGuest);

          this._notificationService.success('Speichern erfolgreich', {
            autoClose: true,
            keepAfterRouteChange: true,
          });
        }),
        catchError((error) => {
          if (error) {
            this._notificationService.error(error, {
              autoClose: false,
              keepAfterRouteChange: false,
            });
          }

          this.presetFromExistingMatch();
          this._cdr.markForCheck();

          return throwError(() => error);
        })
      )
      .subscribe();
  }

  public positionKeys(): StartingPlayerPosition[] {
    return Object.keys(this.positions) as StartingPlayerPosition[];
  }

  public getPositionTitle(key: string): string {
    return this.positions[key as StartingPlayerPosition] || '';
  }
}
