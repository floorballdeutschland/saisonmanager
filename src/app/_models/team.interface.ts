import { PlayerWithLicense } from './player.interface';

export type TeamType = 'home' | 'guest';

export interface Team {
  id: number;
  name: string;
  short_name: string;
  logo?: string;
  league_id: number;
  cup_leagues: number[];
  club_id: number;
  league_name?: string;
  league_short_name?: string;
  game_operation_id?: number;
  game_operation_name?: string;
  game_operation_short_name?: string;
  game_operation_slug?: string;
  syndicate: boolean;
  syndicate_clubs: number[];
  logo_url: string;
  logo_small: string;
  contact_person?: string;
  contact_email?: string;

  // Nur aus `admin/clubs/:id/teams`: Darf der angemeldete Benutzer das
  // abweichende Logo DIESER Mannschaft pflegen? Pro Mannschaft und nicht pro
  // Verein, weil das Recht am Spielbetrieb der Liga haengt: Ein SBK darf die
  // Mannschaftsliste eines Vereins lesen, aber nicht das Logo einer Mannschaft
  // aendern, die in der Liga eines anderen Verbands spielt.
  manage_logo?: boolean;
}

export interface TeamWithPlayers extends Team {
  players: PlayerWithLicense[];
}
