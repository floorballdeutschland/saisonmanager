import { ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import {
  GameService,
  LeagueService,
  NotificationService,
} from '@floorball/core';
import {
  Game,
  StartingPlayerPosition,
  StartingPlayers,
} from '@floorball/types';
import { tap } from 'rxjs';

@Component({
  selector: 'fb-starting-player',
  templateUrl: './starting-player.component.html',
})
export class StartingPlayerComponent implements OnInit {
  startingHome: StartingPlayers = {
    goal: '',
    defender1: '',
    defender2: '',
    center: '',
    forward1: '',
    forward2: '',
  };
  startingGuest: StartingPlayers = {
    goal: '',
    defender1: '',
    defender2: '',
    center: '',
    forward1: '',
    forward2: '',
  };

  fieldSize!: string;

  positions: {
    forward1: string;
    goal: string;
    forward2: string;
    center: string;
    defender1: string;
    defender2: string;
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

    if (this.match.starting_players.home) {
      this.startingHome = Object.keys(
        this.match.starting_players.home || {}
      ).reduce((acc, item) => {
        return {
          ...acc,
          [item]:
            this.match.starting_players.home[item as keyof StartingPlayers] ||
            '',
        };
      }, this.startingHome);
    }
    if (this.match.starting_players.guest) {
      this.startingGuest = Object.keys(
        this.match.starting_players.guest || {}
      ).reduce((acc, item) => {
        return {
          ...acc,
          [item]:
            this.match.starting_players.guest[item as keyof StartingPlayers] ||
            '',
        };
      }, this.startingGuest);
    }

    console.log(
      this.match.starting_players.home,
      this.match.starting_players.guest
    );
    this._cdr.markForCheck();
  }

  public setStartingPlayer(
    position: StartingPlayerPosition,
    player_id: string
  ) {
    if (player_id) {
      this._gameService
        .setStartingPlayer(
          this.match.id,
          this.team,
          parseInt(player_id, 10),
          position
        )
        .pipe(
          tap((starting) => {
            this.startingHome = starting.home || {};
            this.startingGuest = starting.guest || {};
            this._cdr.markForCheck();

            this._notificationService.success('Speichern erfolgreich', {
              autoClose: true,
              keepAfterRouteChange: true,
            });
          })
        )
        .subscribe();
    }
  }

  public positionKeys(): StartingPlayerPosition[] {
    return Object.keys(this.positions) as StartingPlayerPosition[];
  }

  public getPositionTitle(key: StartingPlayerPosition): string {
    return this.positions[key] || '';
  }
}
