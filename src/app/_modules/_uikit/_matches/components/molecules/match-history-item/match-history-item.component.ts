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
  NormalizedEvent,
  Penalty,
  PenaltyCode,
} from '@floorball/types';
import { GameService, NotificationService } from '@floorball/core';

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
   * http://localhost:4200/fd/1044/spiel/17098
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
    private _notificationService: NotificationService,
    private _cdr: ChangeDetectorRef
  ) {}

  // Time-Outs sind keine Events, sondern Spielfelder – sie werden über
  // GameService#clearTimeout geleert, events/remove findet die Pseudo-Events
  // nicht und lief bisher wirkungslos ins Leere.
  public handleDelete(gameEvent: NormalizedEvent) {
    if (gameEvent.event_type === 'timeout') {
      this._gameService
        .clearTimeout(
          this.match.id,
          gameEvent.event_team === 'home' ? 'home' : 'guest'
        )
        .subscribe({
          next: () => {
            this._notificationService.success('Time-Out entfernt', {
              autoClose: true,
              keepAfterRouteChange: true,
            });
            this.reloadGame.emit();
          },
        });
      return;
    }

    this._gameService.deleteEvent(this.match.id, gameEvent.event_id).subscribe({
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
