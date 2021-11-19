import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ViewEncapsulation,
} from '@angular/core';

@Component({
  selector: 'fb-next-match-list',
  templateUrl: './next-match-list.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NextMatchListComponent {
  @Input()
  // TODO Type
  matches!: unknown[];
}
