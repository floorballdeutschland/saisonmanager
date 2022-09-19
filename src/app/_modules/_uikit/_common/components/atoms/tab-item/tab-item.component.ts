import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ViewEncapsulation,
} from '@angular/core';

@Component({
  selector: 'fb-tab-item',
  templateUrl: './tab-item.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabItemComponent {
  @Input()
  activeColor = '#000000';

  @Input()
  isActive = false;

  @Input()
  markedAsActive?: boolean;

  @Input()
  link!: string | string[];
}
