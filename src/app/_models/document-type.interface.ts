// Katalog-Eintrag einer Dokumentart für Lizenz-Pflichtdokumente.
// game_operation_id = null bedeutet global (bundesweit), sonst
// verbandsspezifisch. `key` ist der stabile technische Bezeichner, über den
// Ligen (required_documents) und Uploads (document_type) referenzieren.
// `validity`: 'once' = einmal je Spieler, gilt für immer; 'per_season' =
// muss je Saison neu vorliegen. `required_below_age`: nur erforderlich, wenn
// der Spieler am Tag der Lizenzbeantragung jünger ist; null = immer.
export interface DocumentType {
  id: number;
  key: string;
  name: string;
  description?: string | null;
  game_operation_id: number | null;
  validity: 'once' | 'per_season';
  required_below_age: number | null;
  template_url: string | null;
  // Nur im Index-Endpoint enthalten:
  usage_count?: number;
  league_count?: number;
}
