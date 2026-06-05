export interface ApiKey {
  id: number;
  name: string;
  active: boolean;
  rate_limit: number | null;
  realtime: boolean;
  created_at: string;
  last_used_at: string | null;
}

export interface CreatedApiKey extends ApiKey {
  raw_key: string;
}
