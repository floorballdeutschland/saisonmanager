import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ComponentRef,
  Input,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { NotificationService, OverlayService } from '@floorball/core';
import { NotificationType, UserNotification } from '@floorball/types';
import { Subscription } from 'rxjs';

import { MobileHeaderComponent } from '..';

@Component({
  selector: 'fb-notification',
  templateUrl: './notification.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationComponent implements OnInit {
  @Input() id = 'default-notification';
  @Input() fade = true;

  notifications: UserNotification[] = [];
  notificationSubscription!: Subscription;
  routeSubscription!: Subscription;

  // notification$ = this._notificationService.notification$;
  // show = false;

  overlayComponentRef?: ComponentRef<MobileHeaderComponent>;

  constructor(
    private _notificationService: NotificationService,
    private _cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.notificationSubscription = this._notificationService
      .onNotification(this.id)
      .subscribe((notification) => {
        // clear notifications when an empty notification is received
        if (!notification.message) {
          // filter out notifications without 'keepAfterRouteChange' flag
          this.notifications = this.notifications.filter(
            (x) => x.keepAfterRouteChange
          );

          // remove 'keepAfterRouteChange' flag on the rest
          this.notifications.forEach((x) => delete x.keepAfterRouteChange);

          return;
        }

        // add notification to array
        this.notifications.push(notification);

        // auto close notification if required
        if (notification.autoClose) {
          setTimeout(() => this.removeNotification(notification), 3000);
        }

        this._cdr.markForCheck();
      });

    this.routeSubscription = this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this._notificationService.clear(this.id);
      }
    });
  }

  public removeNotification(notification: UserNotification) {
    // check if already removed to prevent error on auto close
    if (!this.notifications.includes(notification)) return;

    if (this.fade) {
      // fade out notification
      const not = this.notifications.find((x) => x === notification);
      if (not) {
        not.fade = true;
      }

      // remove notification after faded out
      setTimeout(() => {
        this.notifications = this.notifications.filter(
          (x) => x !== notification
        );

        this._cdr.markForCheck();
      }, 250);
    } else {
      // remove notification
      this.notifications = this.notifications.filter((x) => x !== notification);

      this._cdr.markForCheck();
    }
  }

  cssClass(notification: UserNotification) {
    if (!notification) return;

    const classes = ['alert', 'alert-dismissable'];

    const notificationTypeClass = {
      [NotificationType.Success]: 'alert alert-success',
      [NotificationType.Error]: 'alert alert-danger',
      [NotificationType.Info]: 'alert alert-info',
      [NotificationType.Warning]: 'alert alert-warning',
    };

    if (notification.type) {
      classes.push(notificationTypeClass[notification.type]);
    }

    if (notification.fade) {
      classes.push('fade');
    }

    return classes.join(' ');
  }

  public getType(
    notType: 'success' | 'error' | 'info' | 'warning'
  ): NotificationType {
    const notificationTypeClass = {
      success: NotificationType.Success,
      error: NotificationType.Error,
      info: NotificationType.Info,
      warning: NotificationType.Warning,
    };

    return notificationTypeClass[notType];
  }
}
