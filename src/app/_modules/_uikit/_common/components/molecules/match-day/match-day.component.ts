import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  ViewEncapsulation,
} from '@angular/core';

@Component({
  selector: 'fb-match-day',
  templateUrl: './match-day.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class MatchDayComponent {
  @Input()
  matchDays: Array<{ game_day_number: number; title: string }> = [];

  @Input()
  selectedMatchDay!: { game_day_number: number; title: string };

  @Output()
  selectMatchDay: EventEmitter<number> = new EventEmitter<number>();
}
