import {
  Component,
  ViewEncapsulation,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { Observable } from 'rxjs';
import { Game } from '@floorball/types';
import { AssociationService, GameService } from '@floorball/core';
import { ActivatedRoute } from '@angular/router';

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
    private _route: ActivatedRoute
  ) {}

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
  }
}
