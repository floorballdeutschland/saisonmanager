// Ansprechpersonen der laufenden Saison, gebündelt für die
// Spielbetriebskommission (GET admin/contacts). Gruppiert nach Verein, je
// Verein die Mannschaften der Saison.

// Konto einer Vereins- oder Teammanagerin bzw. eines Managers.
export interface ContactManager {
  id: number;
  name: string;
  email: string | null;
  last_login_at: string | null;
}

export interface ContactTeam {
  id: number;
  name: string;
  league_id: number;
  league_name: string | null;
  game_operation_name: string | null;
  // Am Team hinterlegte Ansprechperson, unabhängig von den Konten.
  contact_person: string | null;
  contact_email: string | null;
  managers: ContactManager[];
}

export interface ContactClub {
  id: number;
  name: string;
  contact_email: string | null;
  state_association_name: string | null;
  // Nur die in der Vereinsverwaltung unter „Zusätzlich informieren"
  // markierten Vereinsmanager, also dieselbe Auswahl wie beim Versand der
  // Vereinspost. Nicht jedes Konto mit Vereinsmanager-Rolle.
  notify_managers: ContactManager[];
  teams: ContactTeam[];
}

export interface ContactList {
  season_id: string;
  clubs: ContactClub[];
}
