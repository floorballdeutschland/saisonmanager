import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ComponentRef,
  Input,
  ViewEncapsulation,
} from '@angular/core';
import { OverlayService } from '@floorball/core';
import { GameOperation, StateAssociation } from '@floorball/types';
import { take, tap } from 'rxjs';
import { MobileHeaderComponent } from '..';

@Component({
  selector: 'fb-sidebar',
  templateUrl: './sidebar.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class SidebarComponent {
  @Input() association?: GameOperation | null;
  @Input() stateAssociation?: StateAssociation | null;
  @Input() activeBanner?: { url: string; linkUrl?: string | null } | null;

  overlayComponentRef?: ComponentRef<MobileHeaderComponent>;
  menuIsOpen = false;

  constructor(
    private _overlayService: OverlayService,
    private _cdr: ChangeDetectorRef
  ) {}

  openMenu() {
    this.overlayComponentRef = this._overlayService.showScrollBlockingOverlay(
      MobileHeaderComponent
    );

    this.menuIsOpen = true;

    this.overlayComponentRef?.instance.onClose$
      .pipe(
        tap(() => {
          this.menuIsOpen = false;
          this._cdr.markForCheck();
        }),
        take(1)
      )
      .subscribe();
  }

  closeMenu() {
    this.overlayComponentRef?.instance.onClose$.next(true);
  }

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
