import {
  ChangeDetectorRef,
  Component,
  OnInit,
  ViewEncapsulation,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  AssociationService,
  GameService,
  LeagueService,
} from '@floorball/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { Arena, Club, GamedayWithGames, Team } from '@floorball/types';

@Component({
  templateUrl: './schedule-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class ScheduleIndexComponent implements OnInit {
  gameDays: GamedayWithGames[] = [];
  clubs: Club[] = [];
  teams: Team[] = [];
  arenas: Arena[] = [];

  newGameOpen: number[] = [];
  openGameDays: number[] = [];
  leagueId = 0;
  // Ob die Liga die Ansetzung durch die RSK nutzen darf (LV-Flag / FD immer aktiv).
  refereeAssignmentEnabled = false;

  loading = true;

  secretaryLinkByGameDay: Record<
    number,
    { url: string; expires_at: string } | null
  > = {};
  secretaryLinkGenerating: Record<number, boolean> = {};

  constructor(
    private _associationService: AssociationService,
    private _leagueService: LeagueService,
    private _gameService: GameService,
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
              this.refereeAssignmentEnabled =
                result.referee_assignment_enabled ?? false;
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
  public generateSecretaryLink(gameDayId: number): void {
    this.secretaryLinkGenerating[gameDayId] = true;
    this._gameService.createSecretaryLink(gameDayId).subscribe({
      next: (result) => {
        this.secretaryLinkByGameDay[gameDayId] = {
          url: result.url,
          expires_at: result.expires_at,
        };
        this.secretaryLinkGenerating[gameDayId] = false;
        this._cdr.markForCheck();
      },
      error: () => {
        this.secretaryLinkGenerating[gameDayId] = false;
        this._cdr.markForCheck();
      },
    });
  }

  public copyToClipboard(text: string): void {
    navigator.clipboard?.writeText(text);
  }

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
