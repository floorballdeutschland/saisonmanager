import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import { Game, GameEvent } from '@floorball/types';
import {
  AssociationService,
  GameService,
  LeagueService,
  SessionService,
} from '@floorball/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'fb-match-history-item',
  templateUrl: './match-history-item.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class MatchHistoryItemComponent {
  /**
   * TODO
   * Fehlende EventTypes
   * penalty_shots
   * penalty_shot
   * http://localhost:4200/fvd/1044/spiel/17098
   */

  @Input()
  match!: Game;

  @Input()
  event!: GameEvent;

  @Input()
  isLast = false;

  @Input()
  allowCancel = false;

  @Output()
  reloadGame: EventEmitter<void> = new EventEmitter<void>();

  constructor(
    private _gameService: GameService,
    private _cdr: ChangeDetectorRef
  ) {}

  public handleDelete(id: string) {
    this._gameService.deleteEvent(this.match.id, id).subscribe({
      next: (result) => {
        this.reloadGame.emit();
        console.log(result);
      },
    });
  }
}
