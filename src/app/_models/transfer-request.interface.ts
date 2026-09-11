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
  // Schritt hat nachweislich stattgefunden, aber ohne festgehaltenen
  // Zeitpunkt (Altbestand vor Einführung von withdrawn_at). Die Ansicht zeigt
  // ihn dann ohne Datum, statt ihn wegzulassen.
  timeUnknown?: boolean;
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

  /**
   * Kürzel des im Verein eingetragenen Landesverbands, für die CSV-Ausfuhr der
   * Vorgänge (fe#439). Bewusst der eingetragene Verband und nicht der
   * Spielverbund: Über den Antrag entscheidet die Wurzel des Verbandsbaums,
   * abgerechnet wird aber beim eingetragenen Verband.
   *
   * Leer, wenn der Verband kein Kürzel gepflegt hat oder der Verein keinem
   * Landesverband zugeordnet ist -- beides kommt im Bestand vor, und ein
   * Rückfall auf den ausgeschriebenen Namen machte die Spalte unauswertbar.
   */
  state_association_short_name?: string | null;
}

/**
 * Anschrift und Kontakt eines beteiligten Vereins, für die Transferrechnung
 * (api#641). Kommt nur im abgeschlossenen Vorgang mit.
 *
 * Jedes Feld einzeln optional: Der Bestand ist unvollständig, es gab keinen
 * Datenlauf. Was nicht gepflegt ist, kommt als `null` und wird leer angezeigt.
 */
export interface TransferRequestClubAddress {
  long_name?: string | null;
  street?: string | null;
  house_number?: string | null;
  postcode?: string | null;
  city?: string | null;
  contact_email?: string | null;
}

export interface TransferRequestClubAddresses {
  requesting_club: TransferRequestClubAddress;
  former_club: TransferRequestClubAddress;
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

  /**
   * Anschrift und Kontakt beider beteiligten Vereine. Der abgebende
   * Landesverband stellt die Transferrechnung an den aufnehmenden Verein und
   * braucht dafür dessen ladungsfähige Anschrift; der aufnehmende Verein
   * braucht die Gegenseite, um die Rechnung einzuordnen.
   *
   * Nur am abgeschlossenen Vorgang und nur in der Antwort zum einzelnen
   * Vorgang -- die Übersicht rendert denselben Hash, und dort haben Anschriften
   * nichts zu suchen. Fehlt der Block, ist der Vorgang nicht abgeschlossen.
   */
  club_addresses?: TransferRequestClubAddresses | null;
}
