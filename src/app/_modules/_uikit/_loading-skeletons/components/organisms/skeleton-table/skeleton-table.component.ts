import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ViewEncapsulation,
} from '@angular/core';

@Component({
  selector: 'fb-skeleton-table',
  templateUrl: './skeleton-table.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class SkeletonTableComponent {
  @Input()
  type: 'default' | 'medium' | 'small' = 'default';

  @Input()
  amount = 10;
}
