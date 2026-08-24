export interface ClubMembership {
  club_id: number;
  home_club: boolean;
  created_at?: string;
  valid_until?: string;

  // Handelndes Konto beim Anlegen (created_by) und beim Beenden
  // (valid_set_by) der Zugehörigkeit. Die IDs schreibt die API beim Anlegen und
  // Beenden mit, Einträge aus dem Altbestand tragen sie nicht. Die Namen löst
  // die API für jeden auf, der das Profil öffnen darf; leer bleiben sie, wenn
  // das Konto nicht mehr auffindbar ist oder keinen Namen hinterlegt hat.
  created_by?: number | null;
  created_by_name?: string | null;
  valid_set_by?: number | null;
  valid_set_by_name?: string | null;
}
