export interface LicenseDocument {
  id: number;
  document_type: string;
  filename: string;
  content_type: string;
  byte_size: number;
  created_at: string;
  url: string;
  season_id?: number | null;
  // Katalog-/Verbandsdaten (vom API-Endpunkt angereichert); fehlen bei
  // Freitext-Altbestand ohne Katalogeintrag.
  document_type_name?: string | null;
  validity?: string | null;
  // game_operation_id = null → bundesweit/global gültige Dokumentart.
  game_operation_id?: number | null;
  game_operation_name?: string | null;
}
