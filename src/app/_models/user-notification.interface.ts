export interface UserNotification {
  message?: string;
  link?: string;
  id: string;
  type?: NotificationType;

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
