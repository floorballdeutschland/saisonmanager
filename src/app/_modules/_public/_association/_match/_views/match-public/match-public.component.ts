import { Component, Input, OnInit } from '@angular/core';
import { Game } from '@floorball/types';

@Component({
  selector: 'fb-match-public',
  templateUrl: './match-public.component.html',
})
export class MatchPublicComponent {
  @Input()
  game!: Game;
}
