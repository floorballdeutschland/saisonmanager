/** Wer hinter einem beantragten Key steht. Bei manuell angelegten Keys leer. */
export interface ApiKeyApplicant {
  id: number;
  organisation: string;
  contact_name: string;
  email: string;
}

/**
 * Zusatzpakete, die ein Key nur mit ausdrücklicher Freigabe abrufen darf
 * (`ApiKey::FEATURES` in der API). Individuell vereinbart, nie über den Antrag.
 */
export type ApiKeyFeature = 'detailed_stats' | 'league_shot_stats';

export const API_KEY_FEATURES: readonly ApiKeyFeature[] = [
  'detailed_stats',
  'league_shot_stats',
];

export interface ApiKey {
  id: number;
  name: string;
  active: boolean;
  rate_limit: number | null;
  realtime: boolean;
  /** Fehlt bei einer API vor api#868. */
  features?: ApiKeyFeature[];
  created_at: string;
  last_used_at: string | null;
  /** Zugriffe der letzten 30 Tage, summiert über alle Endpunkte. */
  usage_30_days: number;
  application: ApiKeyApplicant | null;
}

export interface CreatedApiKey extends ApiKey {
  raw_key: string;
}
