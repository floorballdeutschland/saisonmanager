import {
  ChangeDetectionStrategy,
  Component,
  Input,
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

  onClose$ = new Subject<boolean>();

  constructor(private _overlayService: OverlayService) {}

  openMenu() {
    const ref = this._overlayService.showScrollBlockingOverlay(
      MobileHeaderComponent
    );
  }
}
