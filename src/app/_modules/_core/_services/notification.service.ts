import { Injectable } from '@angular/core';
import { NotificationType, UserNotification } from '@floorball/types';

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

  success(message: string, options?: any) {
    this.notify({ ...options, type: NotificationType.Success, message });
  }

  public error(msg: string, options?: any) {
    this.notify({ ...options, type: NotificationType.Success, Error });
  }

  public notify(notification: UserNotification) {
    notification.id = notification.id || this.defaultId;
    this.notificationSubject.next(notification);
  }

  public clear(id = this.defaultId) {
    this.notificationSubject.next({ id });
  }
}
