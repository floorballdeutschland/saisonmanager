import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import {
  interval,
  Observable,
  Subject,
  Subscription,
  takeUntil,
  tap,
} from 'rxjs';
import { Game, GameAdditionalFields, GameOperation } from '@floorball/types';
import {
  AssociationService,
  GameService,
  LeagueService,
  SessionService,
} from '@floorball/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { environment } from 'src/environments/environment';

@Component({
  templateUrl: './match.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchComponent implements OnInit, OnDestroy {
  game?: Game;
  additionalFields?: GameAdditionalFields;
  selectedAssociation$!: Observable<GameOperation | null>;

  intervalSub?: Subscription;
  public isLoggedIn$ = this._sessionService.isLoggedIn$;
  public tab = 'public';

  private _destroy$ = new Subject<boolean>();

  constructor(
    private _associationService: AssociationService,
    private _gameService: GameService,
    private _leagueService: LeagueService,
    private _route: ActivatedRoute,
    private _sessionService: SessionService,
    private _router: Router,
    private _cdr: ChangeDetectorRef,
    private _location: Location,
    private _metaTitle: Title
  ) {
    // _router.events.pipe(takeUntil(this._destroy$)).subscribe(() => {
    //   const matchId = this._route.snapshot?.paramMap.get('matchId');
    //   if (matchId) {
    //     this.getMatch(matchId);
    //   }
    // });
  }

  ngOnDestroy(): void {
    this._associationService.displayAssociationHeader$.next(true);
    this._destroy$.next(true);
    this._destroy$.complete();
  }

  ngOnInit(): void {
    this._associationService.displayAssociationHeader$.next(false);
    this.selectedAssociation$ = this._associationService.selectedAssociation$;

    this._route.params.subscribe({
      next: (params) => {
        if (params['matchId']) {
          this.getMatch(params['matchId']);

          if (this.intervalSub) {
            this.intervalSub.unsubscribe();
          }

          const timeout = environment.archiveMode ? 86400000 : 30000;
          this.intervalSub = interval(timeout)
            .pipe(
              tap(() => this.getMatch(params['matchId'])),
              takeUntil(this._destroy$)
            )
            .subscribe();
        }
      },
    });
  }

  getMatch(id: string) {
    this._gameService.getGame(parseInt(id, 10)).subscribe({
      next: (game) => {
        if (this.tab !== 'public') {
          this._gameService.getAdditionalFields(parseInt(id, 10)).subscribe({
            next: (additionalFields) => {
              this.additionalFields = additionalFields;
              this.updateGame(game);
            },
          });
        } else {
          this.updateGame(game);
        }
      },
    });
  }

  reloadGame() {
    if (this.game?.id) {
      this.getMatch(this.game.id.toString());
    }
  }

  public updateGame(game: Game) {
    if (JSON.stringify(game) !== JSON.stringify(this.game)) {
      this.game = game;

      this._metaTitle.setTitle(
        `Spiel ${game.home_team_name} gegen ${game.guest_team_name} - ${game.league_name} | Floorball Saisonmanager`
      );
    }

    this._cdr.markForCheck();
  }

  navigateBack() {
    this._location.back();
  }

  public isTabActive(tabName: string): boolean {
    return this.tab === tabName;
  }

  public setTab(tabName: string) {
    this.tab = tabName;
    this.reloadGame();
    this._cdr.markForCheck();
  }

  public canEdit(game: Game): boolean {
    if (game.permission) {
      return game.permission.includes('edit_game_report');
    } else {
      return false;
    }
  }
}
