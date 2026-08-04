// Zeile der SBK-Übersicht „Spieltage" (GET admin/game_days/report_overview).
// Ein Eintrag je Spiel; die Spieltagssicht gruppiert clientseitig über
// game_day_id.

export type GameReportStatus =
  | 'pregame'
  | 'ingame'
  | 'aftergame'
  | 'match_record_closed'
  | 'finalized';

export interface GameReportScan {
  uploaded_at: string;
  uploaded_by_name: string | null;
  // Abstand zum Spieltag in Tagen. null, wenn das Spieltagsdatum nicht
  // parsebar ist (Altbestand). Bewusst ohne Bewertung: eine Frist gibt es nicht.
  days_after_game_day: number | null;
  expired: boolean;
}

export interface GameReportFlags {
  protest: boolean;
  forfait: boolean;
  special_event_string: string | null;
  // Strafen ab 5 Minuten inklusive Matchstrafen.
  severe_penalty_count: number;
  missing_audience: boolean;
  missing_signatures: boolean;
  missing_referee2: boolean;
}

export interface GameDayReportRow {
  id: number;
  game_number: string | null;
  start_time: string | null;
  game_day_id: number;
  game_day_number: number | null;
  date: string | null;
  league_id: number | null;
  league_name: string | null;
  game_operation_slug: string | null;
  arena_name: string | null;
  hosting_club_name: string | null;
  home_team: string | null;
  guest_team: string | null;
  result_string: string | null;

  game_status: GameReportStatus | null;
  record_created_at: string | null;
  record_updated_at: string | null;
  record_updated_by_name: string | null;
  match_record_closed_at: string | null;

  // Das an die SBK gerichtete Hinweisfeld aus Schritt 3 des Spielberichts.
  record_comment: string | null;

  scan_required: boolean;
  scan: GameReportScan | null;
  referee_report: { uploaded_at: string } | null;
  proceeding_proposal: { id: number; status: string } | null;
  checklist_negative_count: number;
  checklist_veto_submitted_at: string | null;
  checklist_veto_negative_count: number;

  flags: GameReportFlags;
}

export interface GameDayReportOverview {
  // true, wenn die Serverobergrenze griff und die Liste gekürzt wurde.
  truncated: boolean;
  games: GameDayReportRow[];
}

// Die Saison ist serverseitig fest auf die laufende gebunden und bewusst kein
// Filter: Spieltage abgeschlossener Saisons erscheinen in dieser Ansicht nicht.
export interface GameDayReportFilter {
  game_operation_id?: string;
  league_id?: string;
  date_from?: string;
  date_to?: string;
}
