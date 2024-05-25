import { Component, Input } from '@angular/core';

@Component({
  selector: 'fb-player-lineup-item',
  templateUrl: './player-lineup-item.component.html',
})
export class PlayerLineupItemComponent {
  @Input()
  trikot_number!: number;

  @Input()
  player_name!: string;

  @Input()
  position?: string = '';
}
