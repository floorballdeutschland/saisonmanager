export interface LicenseDocument {
  id: number;
  document_type: 'id_copy' | 'parental_consent';
  filename: string;
  content_type: string;
  byte_size: number;
  created_at: string;
  url: string;
}
