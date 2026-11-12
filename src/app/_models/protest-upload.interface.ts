// Upload des Protestformulars über den Link an eine Protestpartei
// (GET/POST protests/:token, ohne Anmeldung).
export interface ProtestUpload {
  status: 'open' | 'submitted';
  party_label: string;
  submitted_at: string | null;
  filename: string | null;
  game_number: string | null;
  home_team: string | null;
  guest_team: string | null;
  league: string | null;
  date: string | null;
  start_time: string | null;
}
