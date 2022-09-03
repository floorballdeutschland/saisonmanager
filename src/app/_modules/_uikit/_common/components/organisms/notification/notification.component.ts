import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ComponentRef,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { NotificationService } from '@floorball/core';

import { MobileHeaderComponent } from '..';

@Component({
  selector: 'fb-notification',
  templateUrl: './notification.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationComponent implements OnInit {
  notification$ = this._notificationService.notification$;
  show = false;

  overlayComponentRef?: ComponentRef<MobileHeaderComponent>;

  constructor(
    private _notificationService: NotificationService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.show = true;
    this.notification$.subscribe({
      next: () => {
        this.show = true;
        setTimeout(() => {
          this.close();
        }, 5000);
      },
    });
  }

  public close() {
    this.show = false;
    this._cdr.markForCheck();
  }
}
