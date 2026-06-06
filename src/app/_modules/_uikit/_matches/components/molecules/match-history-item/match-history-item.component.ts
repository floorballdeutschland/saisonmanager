import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import {
  Game,
  GameAdditionalFields,
  GameEvent,
  Penalty,
  PenaltyCode,
} from '@floorball/types';
import { GameService } from '@floorball/core';

@Component({
  selector: 'fb-match-history-item',
  templateUrl: './match-history-item.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: false,
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

  @Input()
  penalties: Penalty[] = [];

  @Input()
  penaltyCodes: PenaltyCode[] = [];

  @Output()
  reloadGame: EventEmitter<void> = new EventEmitter<void>();

  editingEvent: GameEvent | null = null;
  editingEventPeriod = '';

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

  public handleEdit(event: GameEvent): void {
    this.editingEvent =
      this.editingEvent?.event_id === event.event_id ? null : event;
    this.editingEventPeriod = '';
    this._cdr.markForCheck();
  }

  public handleEditPeriodUpdate(period: string): void {
    this.editingEventPeriod = period;
    this._cdr.markForCheck();
  }

  public cancelEdit(): void {
    this.editingEvent = null;
    this.editingEventPeriod = '';
    this._cdr.markForCheck();
  }

  public handleUpdated(): void {
    this.editingEvent = null;
    this.reloadGame.emit();
  }
}
