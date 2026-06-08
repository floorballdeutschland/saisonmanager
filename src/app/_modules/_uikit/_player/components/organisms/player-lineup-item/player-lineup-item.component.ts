import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'fb-player-lineup-item',
  templateUrl: './player-lineup-item.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class PlayerLineupItemComponent {
  @Input()
  trikot_number!: number;

  @Input()
  player_name!: string;

  @Input()
  player_id?: number;

  @Input()
  position?: string = '';

  @Input()
  youth?: boolean;
}
