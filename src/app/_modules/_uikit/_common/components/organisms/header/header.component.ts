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

  @Input()
  activeBanner?: { url: string; linkUrl?: string | null } | null;

  @Output()
  markAsFavorite: EventEmitter<void> = new EventEmitter<void>();

  @Output()
  removeFromFavorites: EventEmitter<void> = new EventEmitter<void>();

  @Output()
  navigateBack: EventEmitter<void> = new EventEmitter<void>();

  safeBannerLink(url: string | null | undefined): string | null {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:'
        ? url
        : null;
    } catch {
      return null;
    }
  }
}
