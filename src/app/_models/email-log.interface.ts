export interface EmailLog {
  id: number;
  recipient: string;
  cc: string | null;
  subject: string;
  mailer_action: string | null;
  sent_at: string;
}
