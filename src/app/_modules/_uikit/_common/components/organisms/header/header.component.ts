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
  standalone: false,
})
export class HeaderComponent {
  @Input()
  headline = '';

  @Input()
  subline = '';

  @Input()
  type: 'league' | 'match' | 'team' = 'league';

  @Input()
  isMarkedAsFavorite = false;

  @Output()
  markAsFavorite: EventEmitter<void> = new EventEmitter<void>();

  @Output()
  removeFromFavorites: EventEmitter<void> = new EventEmitter<void>();

  @Output()
  navigateBack: EventEmitter<void> = new EventEmitter<void>();
}
