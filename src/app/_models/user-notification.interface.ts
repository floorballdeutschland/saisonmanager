export interface UserNotification extends UserNotificationOptions {
  message?: string;
  link?: string;
  id: string;
  type?: NotificationType;
}

export interface UserNotificationOptions {
  autoClose?: boolean;
  keepAfterRouteChange?: boolean;
  fade?: boolean;
}

export enum NotificationType {
  Success,
  Error,
  Info,
  Warning,
}
