// Obergrenze der Anmerkung zum Einspruch gegen den Spieltagsbericht, gilt für
// Gastmannschaft und Schiedsrichter. Muss zu
// GameDayConfirmationComment::COMMENT_MAX_LENGTH in der API passen, die API
// weist längere Texte mit 422 ab.
export const CONFIRMATION_COMMENT_MAX_LENGTH = 2000;

export interface TeamGameDayChecklistItem {
  id: number;
  question: string;
}

export interface TeamGameDayChecklistAnswer {
  item_id: number;
  question: string;
  answer: boolean;
}

export interface TeamGameDayGame {
  id: number;
  game_number?: string;
  start_time?: string;
  home_team?: string;
  guest_team?: string;
  result?: string;
}

/** Eine vom Benutzer verantwortete Gastmannschaft an einem Spieltag. */
export interface TeamGameDayTeam {
  team_id: number;
  team_name: string;
  confirmed_at?: string | null;
  properly_conducted?: boolean | null;
  checklist_answers: TeamGameDayChecklistAnswer[];
  comment?: string | null;
}

export interface TeamGameDay {
  id: number;
  date: string;
  league?: string;
  arena?: string;
  club?: string;
  auto_confirmed: boolean;
  confirmable_from?: string | null;
  // Ende der Frist, nach dem der Spieltag automatisch als bestaetigt gilt
  // (GameDay#team_confirmation_deadline in der API). Fehlt, wenn die API
  // sie nicht bestimmen kann.
  confirmable_until?: string | null;
  checklist_required: boolean;
  checklist_items: TeamGameDayChecklistItem[];
  my_teams: TeamGameDayTeam[];
  games: TeamGameDayGame[];
}

export interface TeamGameDayConfirmResponse {
  team_id: number;
  confirmed_at: string;
  properly_conducted: boolean;
  checklist_answers: TeamGameDayChecklistAnswer[];
  comment?: string | null;
}
