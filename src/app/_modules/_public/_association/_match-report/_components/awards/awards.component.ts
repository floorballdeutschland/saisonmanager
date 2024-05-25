import { ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import {
  GameService,
  LeagueService,
  NotificationService,
} from '@floorball/core';
import {
  AwardDefinitions,
  AwardPlayer,
  Game,
  TeamType,
} from '@floorball/types';
import { tap, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'fb-awards',
  templateUrl: './awards.component.html',
})
export class AwardsComponent implements OnInit {
  awardDefinitions: { [key in AwardDefinitions]: string } = {
    mvp: 'Wertvollste:r Spieler:in',
  };

  awardsHome: AwardPlayer[] = [];
  awardsGuest: AwardPlayer[] = [];

  teams: TeamType[] = ['home', 'guest'];

  @Input()
  match!: Game;

  constructor(
    private _gameService: GameService,
    private _leagueService: LeagueService,
    private _notificationService: NotificationService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.presetFromExistingMatch();
  }

  public presetFromExistingMatch() {
    if (this.match.awards.home) {
      this.awardsHome = [...this.match.awards.home] || [];
    }
    if (this.match.awards.guest) {
      this.awardsGuest = [...this.match.awards.guest] || [];
    }

    this._cdr.markForCheck();
  }

  public setAward(award: AwardDefinitions, team: TeamType, player_id: number) {
    console.log(award, team, player_id);
    this._gameService
      .setPlayerAward(this.match.id, team, player_id, award)
      .pipe(
        tap((awards) => {
          this.awardsHome = awards.home || [];
          this.awardsGuest = awards.guest || [];
          this._cdr.markForCheck();

          this._notificationService.success('Speichern erfolgreich', {
            autoClose: true,
            keepAfterRouteChange: true,
          });
        }),
        catchError((error) => {
          if (error) {
            this._notificationService.error(error, {
              autoClose: true,
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
}
