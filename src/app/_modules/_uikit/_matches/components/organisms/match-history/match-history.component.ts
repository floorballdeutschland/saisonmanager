import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import { Game, GameAdditionalFields } from '@floorball/types';

@Component({
  selector: 'fb-match-history',
  templateUrl: './match-history.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchHistoryComponent {
  @Input()
  match!: Game;

  @Input()
  additionalFields?: GameAdditionalFields;

  @Input()
  allowCancel = false;

  @Input()
  newestFirst = false;

  @Input()
  showTrikotNumber = false;

  @Output()
  reloadGame: EventEmitter<void> = new EventEmitter<void>();

  public handleReload() {
    this.reloadGame.emit();
  }
}
