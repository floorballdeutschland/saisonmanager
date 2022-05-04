import { Injectable } from '@angular/core';
import { UserNotification } from '@floorball/types';

import { Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private notificationSubject = new Subject<UserNotification>();
  public notification$: Observable<UserNotification> =
    this.notificationSubject.asObservable();

  public success(msg: string) {
    this.notificationSubject.next({
      messageType: 'success',
      message: msg,
    });
  }
}
