export interface UserNotification extends UserNotificationOptions {
  message?: string;
  link?: string;
  id: string;
  type?: NotificationType;
  /**
   * Nimmt genau die stehenden Meldungen mit diesem Text weg, statt wie eine
   * Meldung ohne `message` den ganzen Stapel zu räumen. Gebraucht für Hinweise,
   * die ein späteres Ereignis überholt, etwa die Verbindungsmeldung, sobald
   * wieder eine Antwort ankommt.
   */
  remove?: string;
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
