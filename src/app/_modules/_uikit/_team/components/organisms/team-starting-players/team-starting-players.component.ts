import { Component, Input } from '@angular/core';
import { StartingPlayer } from '@floorball/types';

@Component({
  selector: 'fb-team-starting-players',
  templateUrl: './team-starting-players.component.html',
  styleUrls: ['./team-starting-players.component.scss'],
  standalone: false,
})
export class TeamStartingPlayersComponent {
  @Input()
  players: StartingPlayer[] = [];

  @Input()
  fieldSize!: string;
}
