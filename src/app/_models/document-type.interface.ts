// Katalog-Eintrag einer Dokumentart für Lizenz-Pflichtdokumente.
// game_operation_id = null bedeutet global (bundesweit), sonst
// verbandsspezifisch. `key` ist der stabile technische Bezeichner, über den
// Ligen (required_documents) und Uploads (document_type) referenzieren.
// `validity`: 'once' = einmal je Spieler, gilt für immer; 'per_season' =
// muss je Saison neu vorliegen.
//
// Altersregel in zwei Formen, die sich ausschließen (die API lehnt beide
// zusammen ab); beide null = immer erforderlich:
// `required_below_age`: nur erforderlich, wenn der Spieler am Tag der
// Lizenzbeantragung jünger ist. Tagesgenauer Stichtag.
// `required_from_birth_year`: erforderlich für alle, die im angegebenen Jahr
// oder später geboren sind. Gilt für den ganzen Jahrgang, unabhängig von
// Geburtstag und Antragsdatum.
export interface DocumentType {
  id: number;
  key: string;
  name: string;
  description?: string | null;
  game_operation_id: number | null;
  validity: 'once' | 'per_season';
  required_below_age: number | null;
  required_from_birth_year: number | null;
  template_url: string | null;
  // Nur in der spielerbezogenen Auswahlliste enthalten
  // (admin/players/:id/document_types):
  game_operation_name?: string | null;
  // Nur im Index-Endpoint enthalten:
  usage_count?: number;
  league_count?: number;
}

// Welche Form der Altersregel eine Dokumentart benutzt. Nur in der Pflegemaske
// verwendet: Über die Leitung gehen die beiden Zahlfelder, nicht diese Angabe.
export type DocumentTypeAgeRule = 'none' | 'below_age' | 'from_birth_year';
