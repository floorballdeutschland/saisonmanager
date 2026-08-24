export interface ClubMembership {
  club_id: number;
  home_club: boolean;
  created_at?: string;
  valid_until?: string;

  // Handelndes Konto beim Anlegen (created_by) und beim Beenden
  // (valid_set_by) der Zugehörigkeit. Die IDs schreibt die API seit jeher mit,
  // die Namen löst sie nur für die Geschäftsstelle und die zuständige
  // Spielbetriebskommission auf; für Vereins- und Teammanager bleiben sie leer.
  created_by?: number | null;
  created_by_name?: string | null;
  valid_set_by?: number | null;
  valid_set_by_name?: string | null;
}
