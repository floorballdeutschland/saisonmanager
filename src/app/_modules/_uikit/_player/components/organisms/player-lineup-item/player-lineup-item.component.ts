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
  player_id?: number;

  @Input()
  position?: string = '';

  @Input()
  birthdate?: string;

  get isYouth(): boolean {
    if (!this.birthdate) return false;
    const today = new Date();
    const birth = new Date(this.birthdate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age < 18;
  }
}
