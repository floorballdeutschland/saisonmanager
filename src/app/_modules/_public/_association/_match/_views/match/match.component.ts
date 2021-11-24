import {
  Component,
  ViewEncapsulation,
  ChangeDetectionStrategy,
  OnInit,
} from '@angular/core';
import { Observable } from 'rxjs';
import { Game } from '@floorball/types';
import { GameService } from '@floorball/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  templateUrl: './match.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchComponent implements OnInit {
  match$?: Observable<Game | null>;

  constructor(
    private _gameService: GameService,
    private _route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const matchId = this._route.snapshot?.paramMap.get('matchId');
    if (matchId) {
      this.getMatch(matchId);
    }
  }

  getMatch(id: string) {
    this.match$ = this._gameService.getGame(parseInt(id));
  }
}
