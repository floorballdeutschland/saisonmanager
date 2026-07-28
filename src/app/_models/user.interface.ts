export interface User {
  id: number;
  email: string;
  // Neue E-Mail-Adresse, solange ihre Bestätigung aussteht (Double-Opt-In).
  pending_email?: string | null;
  username: string;
  name: string;
  // Einzelfelder zum zusammengesetzten name – belegen das Namensformular
  // unter „Mein Konto" vor.
  first_name?: string;
  last_name?: string;
  // Gesetzt, wenn das Konto mit einer Schiedsrichter-Lizenz verknüpft ist.
  // Solche Konten dürfen ihren Namen nicht selbst ändern (er steht auf dem
  // Schiedsrichterausweis); das Backend lehnt es ebenfalls ab.
  referee_id?: number | null;
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

export interface EmailChangeAnswer extends LoginAnswer {
  // true, wenn die neue Adresse bereits an einem anderen Konto hängt. Das ist
  // erlaubt (Vereins-Sammelpostfach, Schiri- und VM-Konto derselben Person)
  // und wird nur als Hinweis gezeigt, damit ein Tippfehler auf einer fremden
  // Adresse nicht unbemerkt bleibt.
  email_in_use?: boolean;
}
