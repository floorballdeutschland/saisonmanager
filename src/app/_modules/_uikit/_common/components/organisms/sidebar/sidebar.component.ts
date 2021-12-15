import {
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  ElementRef,
  Input,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { OverlayService } from '@floorball/core';
import { GameOperation } from '@floorball/types';
import { Subject } from 'rxjs';
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

  constructor(private _overlayService: OverlayService) {}

  openMenu() {
    this.overlayComponentRef = this._overlayService.showScrollBlockingOverlay(
      MobileHeaderComponent
    );
    this.menuIsOpen = true;
  }

  closeMenu() {
    this.overlayComponentRef?.instance.onClose$.next(true);

    this.menuIsOpen = false;
  }
}
