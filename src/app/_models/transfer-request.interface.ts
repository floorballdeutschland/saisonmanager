export type TransferRequestType = 'transfer' | 'release';

export type TransferRequestStatus =
  | 'pending_club'
  | 'pending_player'
  | 'pending_lv'
  | 'scheduled'
  | 'approved'
  | 'rejected_by_club'
  | 'rejected_by_player'
  | 'rejected_by_lv'
  | 'revoked'
  | 'withdrawn'
  | 'expired';

// Ein Schritt in der Chronik eines Vorgangs, für die Detailansicht aus den
// Zeitpunkt- und Konto-Feldern eines TransferRequest zusammengestellt.
// `kind` steuert nur die Darstellung: 'done' für vollzogene Schritte,
// 'rejected' für Ablehnung, Widerruf und Abbruch.
export interface TransferProtocolStep {
  key: string;
  at?: string | null;
  actorName?: string | null;
  actorId?: number | null;
  kind: 'done' | 'rejected';
  note?: string | null;
}

export interface TransferRequestPlayer {
  id: number;
  first_name: string;
  last_name: string;
  birthdate: string;
}

export interface TransferRequestClub {
  id: number;
  name: string;
}

export interface TransferRequest {
  id: number;
  status: TransferRequestStatus;
  request_type: TransferRequestType;
  direct?: boolean;
  season_id: number;
  rejection_reason?: string;
  revocation_reason?: string;
  effective_date?: string | null;
  player: TransferRequestPlayer;
  requesting_club: TransferRequestClub;
  former_club: TransferRequestClub;

  // Zu jedem Schritt Zeitpunkt und handelndes Konto. Der Name ist die Anzeige,
  // die ID bleibt die belastbare Angabe, wenn ein Konto umbenannt oder gelöscht
  // wurde; ein nicht mehr auffindbares Konto liefert die ID ohne Namen.
  //
  // Die Bestätigung oder Ablehnung durch die Person selbst läuft über den Link
  // in ihrer Mail, ohne Anmeldung: dort gibt es einen Zeitpunkt, aber kein
  // Konto. Der Fristablauf hat weder das eine noch das andere, ein
  // `expired_at` existiert nicht; erkennbar ist er allein am Status.
  created_at: string;
  created_by?: number | null;
  created_by_name?: string | null;
  club_approved_at?: string | null;
  approved_by_club_user_id?: number | null;
  approved_by_club_user_name?: string | null;
  player_approved_at?: string | null;
  player_rejected_at?: string | null;
  lv_approved_at?: string | null;
  approved_by_lv_user_id?: number | null;
  approved_by_lv_user_name?: string | null;
  rejected_at?: string | null;
  rejected_by?: number | null;
  rejected_by_name?: string | null;
  revoked_at?: string | null;
  revoked_by?: number | null;
  revoked_by_name?: string | null;
  withdrawn_at?: string | null;
  withdrawn_by?: number | null;
  withdrawn_by_name?: string | null;
}
