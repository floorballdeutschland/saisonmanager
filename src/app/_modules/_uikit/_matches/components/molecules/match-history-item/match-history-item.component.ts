import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import { Game, GameAdditionalFields, GameEvent } from '@floorball/types';
import { GameService } from '@floorball/core';

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
  additionalFields?: GameAdditionalFields;

  @Input()
  isLast = false;

  @Input()
  allowCancel = false;

  @Input()
  showTrikotNumber = false;

  @Output()
  reloadGame: EventEmitter<void> = new EventEmitter<void>();

  constructor(
    private _gameService: GameService,
    private _cdr: ChangeDetectorRef
  ) {}

  public handleDelete(id: number) {
    this._gameService.deleteEvent(this.match.id, id).subscribe({
      next: () => {
        this.reloadGame.emit();
      },
    });
  }
}
