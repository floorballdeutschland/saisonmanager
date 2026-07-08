export interface LicenseDocument {
  id: number;
  document_type: string;
  filename: string;
  content_type: string;
  byte_size: number;
  created_at: string;
  url: string;
  season_id?: number | null;
}
