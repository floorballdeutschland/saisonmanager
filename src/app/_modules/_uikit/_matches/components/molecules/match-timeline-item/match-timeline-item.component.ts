import { Component, Input } from '@angular/core';
import { Game, PeriodTitles } from '@floorball/types';

@Component({
  selector: 'fb-match-timeline-item',
  templateUrl: './match-timeline-item.component.html',
  standalone: false,
})
export class MatchTimelineItemComponent {
  @Input()
  last!: boolean;

  @Input()
  game!: Game;

  @Input()
  periodActive!: number;

  @Input()
  gamePeriodOption!: PeriodTitles;
}
