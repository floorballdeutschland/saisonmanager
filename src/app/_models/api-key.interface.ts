export interface ApiKey {
  id: number;
  name: string;
  active: boolean;
  created_at: string;
  last_used_at: string | null;
}

export interface CreatedApiKey extends ApiKey {
  raw_key: string;
}
