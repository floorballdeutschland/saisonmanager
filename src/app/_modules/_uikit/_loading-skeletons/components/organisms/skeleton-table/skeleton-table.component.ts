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
})
export class SkeletonTableComponent {
  @Input()
  type: 'default' | 'small' = 'default';
}
