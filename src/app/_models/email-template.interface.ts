export interface EmailTemplatePlaceholder {
  key: string;
  description: string;
}

export interface EmailTemplate {
  key: string;
  mailer_class: string;
  action_name: string;
  description: string;
  placeholders: EmailTemplatePlaceholder[];
  default_subject: string | null;
  default_body: string | null;
  default_from: string | null;
  default_reply_to: string | null;
  subject: string | null;
  body: string | null;
  from_address: string | null;
  reply_to_address: string | null;
  customized: boolean;
}

export interface EmailTemplateUpdatePayload {
  mailer_class: string;
  action_name: string;
  subject: string;
  body: string;
  from_address: string;
  reply_to_address: string;
}
