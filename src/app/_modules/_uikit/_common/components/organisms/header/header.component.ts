import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  ViewEncapsulation,
} from '@angular/core';

@Component({
  selector: 'fb-header',
  templateUrl: './header.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  @Input()
  headline = '';

  @Input()
  subline = '';

  @Input()
  type: 'league' | 'match' | 'team' = 'league';

  @Output()
  markAsFavorite: EventEmitter<void> = new EventEmitter<void>();
}
