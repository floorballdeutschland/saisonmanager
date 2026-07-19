export interface User {
  id: number;
  email: string;
  // Neue E-Mail-Adresse, solange ihre Bestätigung aussteht (Double-Opt-In).
  pending_email?: string | null;
  username: string;
  name: string;
  permissions: { [key: string]: boolean };
  club_ids: number[];
  language?: 'de' | 'en';
  receive_info_mails?: boolean;
  // true nur für Teammanager – steuert die Sichtbarkeit des Info-Mail-Toggles.
  can_manage_mail_preferences?: boolean;
  login_blocked_message?: string;
}

export interface LoginAnswer {
  success: boolean;
  user: User;
}
