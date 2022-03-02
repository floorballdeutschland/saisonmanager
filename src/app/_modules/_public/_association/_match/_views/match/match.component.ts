import {
  Component,
  ViewEncapsulation,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
} from '@angular/core';
import { filter, Observable, share, Subject, take, takeUntil, tap } from 'rxjs';
import { Game } from '@floorball/types';
import { AssociationService, GameService } from '@floorball/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { Title } from '@angular/platform-browser';

@Component({
  templateUrl: './match.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchComponent implements OnInit, OnDestroy {
  match$?: Observable<Game | null>;

  private _destroy$ = new Subject<boolean>();

  constructor(
    private _associationService: AssociationService,
    private _gameService: GameService,
    private _route: ActivatedRoute,
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

    this._route.params
      .pipe(
        tap((params) => {
          if (params['matchId']) {
            this.getMatch(params['matchId']);
          }
        }),
        takeUntil(this._destroy$)
      )
      .subscribe();
  }

  getMatch(id: string) {
    this.match$ = this._gameService.getGame(parseInt(id)).pipe(share());
    this.match$
      .pipe(
        filter((m) => !!m),
        tap((match) => {
          if (!match) {
            return;
          }
          this._metaTitle.setTitle(
            `Spiel ${match.home_team_name} gegen ${match.guest_team_name} - ${match.league_name} | SaisonManager`
          );
        }),
        take(1),
        takeUntil(this._destroy$)
      )
      .subscribe();
    this._cdr.markForCheck();
  }

  navigateBack() {
    this._location.back();
  }
}
