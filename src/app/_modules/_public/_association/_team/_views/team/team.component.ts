import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Location } from '@angular/common';
import {
  AssociationService,
  FavoriteService,
  TeamService,
} from '@floorball/core';
import { leagueRouteSegment } from '@floorball/uikit/common';
import { FavoriteTeam, TeamRecentGame, TeamStats } from '@floorball/types';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

@Component({
  templateUrl: './team.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class TeamComponent implements OnInit, OnDestroy {
  public teamId: string | null = null;
  public stats?: TeamStats;
  public loading = true;
  public error = false;
  public isFavorite = false;

  private _operationPath = '';
  private _leaguePath = '';
  private _destroy$ = new Subject<boolean>();

  constructor(
    private _associationService: AssociationService,
    private _teamService: TeamService,
    private _favoriteService: FavoriteService,
    private _location: Location,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._associationService.displayAssociationHeader$.next(false);

    // Read parent route params to build the team URL for favorites
    const snapshot = this._route.snapshot;
    this._leaguePath = snapshot.parent?.paramMap.get('leagueId') ?? '';
    this._operationPath =
      snapshot.parent?.parent?.paramMap.get('association') ?? '';

    this._route.paramMap.pipe(takeUntil(this._destroy$)).subscribe((params) => {
      this.teamId = params.get('teamSlug');
      if (this.teamId) {
        this.isFavorite = this._favoriteService.isTeamFavorite(
          Number(this.teamId)
        );
        this._teamService
          .getTeamStats(Number(this.teamId))
          .pipe(takeUntil(this._destroy$))
          .subscribe({
            next: (data) => {
              this.stats = data;
              this.loading = false;
              this._cdr.markForCheck();
            },
            error: () => {
              this.error = true;
              this.loading = false;
              this._cdr.markForCheck();
            },
          });
      }
    });
  }

  ngOnDestroy(): void {
    this._associationService.displayAssociationHeader$.next(true);
    this._destroy$.next(true);
    this._destroy$.complete();
  }

  navigateBack() {
    this._location.back();
  }

  toggleFavorite(): void {
    const teamId = Number(this.teamId);
    if (this.isFavorite) {
      this._favoriteService.removeTeamFavorite(teamId);
      this.isFavorite = false;
    } else {
      const team: FavoriteTeam = {
        id: teamId,
        name: this.stats?.team?.name ?? '',
        operation_path: this._operationPath,
        league_path: this._leaguePath,
        league_name: this.stats?.team?.league_name ?? null,
      };
      this._favoriteService.addTeamToFavorites(team);
      this.isFavorite = true;
    }
    this._cdr.markForCheck();
  }

  isHomeGame(game: TeamStats['recent_games'][0]): boolean {
    return game.home_team_name === this.stats?.team?.name;
  }

  resultLabel(game: TeamStats['recent_games'][0]): string {
    if (game.home_goals === null || game.guest_goals === null) return '-';
    const isHome = this.isHomeGame(game);
    const own = isHome ? game.home_goals : game.guest_goals;
    const opp = isHome ? game.guest_goals : game.home_goals;
    if (own > opp) return 'S';
    if (own < opp) return 'N';
    return 'U';
  }

  resultClass(game: TeamStats['recent_games'][0]): string {
    const label = this.resultLabel(game);
    if (label === 'S') return 'bg-green-100 text-green-800';
    if (label === 'N') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  }

  // Direktlink zur Spielseite. Die Spiele können über mehrere Ligen des Teams
  // verteilt sein, daher wird das Liga-Segment pro Spiel aus dessen league_id
  // gebaut (nicht aus der aktuell geöffneten Liga).
  gameLink(game: TeamRecentGame): (string | number)[] {
    return [
      '/',
      this._operationPath,
      leagueRouteSegment(game.league_id, game.league_name ?? ''),
      'spiel',
      game.game_id,
    ];
  }
}
