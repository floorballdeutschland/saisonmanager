import { Injectable } from '@angular/core';
import {
  NotificationType,
  UserNotification,
  UserNotificationOptions,
} from '@floorball/types';

import { filter, Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private notificationSubject = new Subject<UserNotification>();

  private defaultId = 'default-notification';

  public notification$: Observable<UserNotification> =
    this.notificationSubject.asObservable();

  onNotification(id = this.defaultId): Observable<UserNotification> {
    return this.notificationSubject
      .asObservable()
      .pipe(filter((x) => x && x.id === id));
  }

  success(message: string, options?: UserNotificationOptions) {
    this.notify({
      id: this.defaultId,
      ...options,
      type: NotificationType.Success,
      message,
    });
  }

  public error(message: string, options?: UserNotificationOptions) {
    this.notify({
      id: this.defaultId,
      ...options,
      type: NotificationType.Error,
      message,
    });
  }

  public warning(message: string, options?: UserNotificationOptions) {
    this.notify({
      id: this.defaultId,
      ...options,
      type: NotificationType.Warning,
      message,
    });
  }

  public notify(notification: UserNotification) {
    this.notificationSubject.next(notification);
  }

  public clear(id = this.defaultId) {
    this.notificationSubject.next({ id });
  }
}
