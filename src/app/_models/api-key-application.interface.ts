/** Zustand des Einmal-Links, über den ein genehmigter Key abgeholt wird. */
export type ApiKeyRevealState =
  | 'valid'
  | 'already_revealed'
  | 'expired'
  | 'invalid';

export type ApiKeyApplicationStatus = 'pending' | 'approved' | 'rejected';

/** Antrag Außenstehender auf einen API-Zugang, wie ihn die Verwaltung sieht. */
export interface ApiKeyApplication {
  id: number;
  organisation: string;
  contact_name: string;
  email: string;
  address: string | null;
  project_description: string;
  purpose: string;
  project_url: string | null;
  commercial: boolean;
  status: ApiKeyApplicationStatus;
  terms_version: string;
  accepted_terms_at: string | null;
  decision_note: string | null;
  decided_at: string | null;
  /** Erst gesetzt, wenn der Key abgeholt wurde. */
  api_key_id: number | null;
  /** Nur bei genehmigten Anträgen gefüllt. */
  reveal_state: ApiKeyRevealState | null;
  reveal_token_expires_at: string | null;
  key_revealed_at: string | null;
  created_at: string;
}

/** Eingaben des öffentlichen Antragsformulars. */
export interface ApiKeyApplicationSubmission {
  accept_terms: boolean;
  commercial: boolean;
  organisation: string;
  contact_name: string;
  email: string;
  address: string;
  project_description: string;
  purpose: string;
  project_url: string;
  terms_version: string;
}

/** Antwort der Abholseite auf die Zustandsprüfung, ohne den Link zu verbrauchen. */
export interface ApiKeyRevealStatus {
  state: ApiKeyRevealState;
  organisation?: string;
  expires_at?: string | null;
}

/** Der Key im Klartext, genau einmal ausgeliefert. */
export interface RevealedApiKey {
  raw_key: string;
  name: string | null;
}
