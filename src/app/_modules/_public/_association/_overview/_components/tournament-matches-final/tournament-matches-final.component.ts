import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { GameScheduleEntry } from '@floorball/types';
import { Observable } from 'rxjs';

@Component({
  selector: 'fb-tournament-matches-final',
  templateUrl: './tournament-matches-final.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TournamentMatchesFinalComponent {
  @Input() matches$?: Observable<GameScheduleEntry[]>;
}
