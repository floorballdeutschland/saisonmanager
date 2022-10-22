import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import { Game } from '@floorball/types';

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
  allowCancel = false;

  @Input()
  newestFirst = false;

  @Output()
  reloadGame: EventEmitter<void> = new EventEmitter<void>();

  public handleReload() {
    this.reloadGame.emit();
  }
}
