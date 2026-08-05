/** Wer hinter einem beantragten Key steht. Bei manuell angelegten Keys leer. */
export interface ApiKeyApplicant {
  id: number;
  organisation: string;
  contact_name: string;
  email: string;
}

export interface ApiKey {
  id: number;
  name: string;
  active: boolean;
  rate_limit: number | null;
  realtime: boolean;
  created_at: string;
  last_used_at: string | null;
  /** Zugriffe der letzten 30 Tage, summiert über alle Endpunkte. */
  usage_30_days: number;
  application: ApiKeyApplicant | null;
}

export interface CreatedApiKey extends ApiKey {
  raw_key: string;
}
