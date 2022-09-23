import {
  ChangeDetectorRef,
  Component,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import {
  ArenaService,
  AssociationService,
  ClubService,
  LeagueService,
  NotificationService,
} from '@floorball/core';
import { Arena, Club, GamedayInput } from '@floorball/types';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  templateUrl: './game-day-edit.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class GameDayEditComponent implements OnInit {
  public gameday!: GamedayInput;
  public leagueId?: number;
  public editMode = true;

  public areans: Arena[] = [];
  public clubs: Club[] = [];

  constructor(
    private _associationService: AssociationService,
    private _leagueService: LeagueService,
    private _arenaService: ArenaService,
    private _clubService: ClubService,
    private _router: Router,
    private _notificationService: NotificationService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title
  ) {
    // this._metaTitle.setTitle('Floorball Saisonmanager');
  }

  public ngOnInit(): void {
    this._route.params.subscribe((params) => {
      if (params['leagueId']) {
        this.leagueId = params['leagueId'];
        this._leagueService
          .getAdminLeagueAdditionalReferences(params['leagueId'])
          .subscribe({
            next: (result) => {
              this.clubs = result.clubs;
              this.areans = result.arenas;
              this._cdr.markForCheck();
            },
          });
      }

      if (params['gameDayId']) {
        this._leagueService.getAdminGameDay(params['gameDayId']).subscribe({
          next: (gameDay) => {
            this.gameday = gameDay;
            this._cdr.markForCheck();
          },
        });
      } else {
        this.editMode = false;
        this.newGameday();
      }
    });
  }

  public newGameday() {
    this.gameday = {
      id: 0,
      number: 0,
      date: '',
      arena_id: 0,
      club_id: 0,
      league_id: 0,
    };

    this._cdr.markForCheck();
  }

  public submit() {
    if (!this.leagueId) {
      return;
    }

    if (this.editMode) {
      const gameday = { ...this.gameday, league_id: this.leagueId };
      this._leagueService.adminUpdateGameDay(gameday).subscribe({
        next: () => {
          this._notificationService.success('Spieltag gespeichert', {
            autoClose: true,
            keepAfterRouteChange: true,
          });

          this._router.navigate([
            '/',
            'verwaltung',
            'ligen',
            this.leagueId,
            'spielplan',
          ]);
        },
      });
    } else {
      const gameday = { ...this.gameday, league_id: this.leagueId };
      delete gameday['id'];
      this._leagueService.adminCreateGameDay(gameday).subscribe({
        next: () => {
          this._notificationService.success('Spieltag erstellt', {
            autoClose: true,
            keepAfterRouteChange: true,
          });

          this._router.navigate([
            '/',
            'verwaltung',
            'ligen',
            this.leagueId,
            'spielplan',
          ]);
        },
      });
    }
  }
}
