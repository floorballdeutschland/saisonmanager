import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ComponentRef,
  Input,
  ViewEncapsulation,
} from '@angular/core';
import { OverlayService } from '@floorball/core';
import { GameOperation } from '@floorball/types';
import { take, tap } from 'rxjs';
import { MobileHeaderComponent } from '..';

@Component({
  selector: 'fb-sidebar',
  templateUrl: './sidebar.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  @Input()
  association?: GameOperation | null;

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
}
