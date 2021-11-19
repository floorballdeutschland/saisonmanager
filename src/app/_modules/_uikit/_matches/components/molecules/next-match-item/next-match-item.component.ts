import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ViewEncapsulation,
} from '@angular/core';

@Component({
  selector: 'fb-next-match-item',
  templateUrl: './next-match-item.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NextMatchItemComponent {
  @Input()
  // TODO Type
  match!: unknown;
}
