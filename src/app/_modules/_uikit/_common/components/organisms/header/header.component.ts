import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ViewEncapsulation
} from '@angular/core';

@Component({
  selector: 'fb-header',
  templateUrl: './header.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class HeaderComponent {
  @Input()
  headline: string = '';

  @Input()
  subline: string = '';

  @Input()
  type: string = 'league';
}
