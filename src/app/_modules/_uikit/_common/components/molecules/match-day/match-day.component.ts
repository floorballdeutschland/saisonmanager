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
})
export class MatchDayComponent {
  @Input()
  matchDays: number[] = [];

  @Input()
  selectedMatchDay!: number;

  @Output()
  selectMatchDay: EventEmitter<number> = new EventEmitter<number>();
}
