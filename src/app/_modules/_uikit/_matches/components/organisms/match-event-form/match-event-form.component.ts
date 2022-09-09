import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ViewEncapsulation,
} from '@angular/core';

@Component({
  selector: 'fb-match-event-form',
  templateUrl: './match-event-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class MatchEventFormComponent {
  @Input()
  type!: string;

  @Input()
  team!: string;
}
