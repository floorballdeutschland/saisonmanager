import {
  ChangeDetectorRef,
  Component,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { AssociationService, LeagueService } from '@floorball/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { Arena, Club, GamedayWithGames, Team } from '@floorball/types';

@Component({
  templateUrl: './schedule-index.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class ScheduleIndexComponent implements OnInit {
  gameDays: GamedayWithGames[] = [];
  clubs: Club[] = [];
  teams: Team[] = [];
  arenas: Arena[] = [];

  newGameOpen: number[] = [];
  openGameDays: number[] = [];
  leagueId = 0;

  loading = true;

  constructor(
    private _associationService: AssociationService,
    private _leagueService: LeagueService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title
  ) {
    this._metaTitle.setTitle('Floorball Saisonmanager');
  }

  public ngOnInit(): void {
    this._route.params.subscribe((params) => {
      if (params['leagueId']) {
        this.leagueId = params['leagueId'];
        this._leagueService
          .getAdminLeagueAdditionalReferences(params['leagueId'])
          .subscribe({
            next: (result) => {
              this.teams = result.teams;
              this.clubs = result.clubs;
              this.arenas = result.arenas;
              this._cdr.markForCheck();
            },
          });
        this.getSchdule(params['leagueId']);
      }
    });
  }

  public getSchdule(leagueId: number) {
    this._leagueService.getAdminGameSchedule(leagueId).subscribe({
      next: (result) => {
        this.gameDays = result.map((gameDay) => ({
          ...gameDay,
          games: [...gameDay.games].sort(
            (a, b) =>
              (parseInt(a.game_number, 10) || 0) -
              (parseInt(b.game_number, 10) || 0)
          ),
        }));
        this._syncOpenGameDays();
        this.loading = false;

        this._cdr.markForCheck();
      },
      error: (error) => {
        console.error(error);
      },
    });
  }

  public toggleNewGame(gameday: number) {
    if (this.newGameOpen.includes(gameday)) {
      this.newGameOpen = this.newGameOpen.filter((item) => item !== gameday);
    } else {
      this.newGameOpen = [...this.newGameOpen, gameday];
    }
  }

  public toggleGameDay(gameDayId: number) {
    if (this.openGameDays.includes(gameDayId)) {
      this.openGameDays = this.openGameDays.filter((id) => id !== gameDayId);
    } else {
      this.openGameDays = [...this.openGameDays, gameDayId];
    }
  }

  public get allExpanded(): boolean {
    return (
      this.gameDays.length > 0 &&
      this.openGameDays.length === this.gameDays.length
    );
  }

  public toggleAllGameDays() {
    this.openGameDays = this.allExpanded
      ? []
      : this.gameDays.map((gd) => gd.id);
  }

  /**
   * Beim ersten Load alle Spieltage öffnen; bei späteren Refreshes neu
   * angelegte Spieltage mit aufnehmen (sonst erscheinen sie zugeklappt)
   * und IDs gelöschter Spieltage verwerfen.
   */
  private _syncOpenGameDays() {
    const currentIds = this.gameDays.map((gd) => gd.id);
    if (this.openGameDays.length === 0) {
      this.openGameDays = currentIds;
      return;
    }
    const known = new Set(this.openGameDays);
    const currentSet = new Set(currentIds);
    const newIds = currentIds.filter((id) => !known.has(id));
    this.openGameDays = [
      ...this.openGameDays.filter((id) => currentSet.has(id)),
      ...newIds,
    ];
  }
}
