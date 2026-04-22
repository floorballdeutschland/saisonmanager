export interface ApiKey {
  id: number;
  name: string;
  active: boolean;
  created_at: string;
  raw_key?: string;
}
