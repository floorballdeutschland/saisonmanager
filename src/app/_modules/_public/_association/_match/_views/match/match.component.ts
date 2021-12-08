import {
  Component,
  ViewEncapsulation,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
} from '@angular/core';
import { Observable } from 'rxjs';
import { Game } from '@floorball/types';
import { AssociationService, GameService } from '@floorball/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  templateUrl: './match.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchComponent implements OnInit, OnDestroy {
  match$?: Observable<Game | null>;

  constructor(
    private _associationService: AssociationService,
    private _gameService: GameService,
    private _route: ActivatedRoute,
    private _router: Router,
    private _cdr: ChangeDetectorRef
  ) {
    _router.events.subscribe(() => {
      const matchId = this._route.snapshot?.paramMap.get('matchId');
      if (matchId) {
        this.getMatch(matchId);
      }
    });
  }

  ngOnDestroy(): void {
    this._associationService.displayAssociationHeader$.next(true);
  }

  ngOnInit(): void {
    this._associationService.displayAssociationHeader$.next(false);
    const matchId = this._route.snapshot?.paramMap.get('matchId');
    if (matchId) {
      this.getMatch(matchId);
    }
  }

  getMatch(id: string) {
    this.match$ = this._gameService.getGame(parseInt(id));
    this._cdr.markForCheck();
  }
}
