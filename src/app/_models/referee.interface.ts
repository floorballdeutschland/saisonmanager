export interface RefereeAdmin {
  id: number;
  lizenznummer: number;
  vorname: string;
  nachname: string;
  geburtsdatum?: string;
  email?: string;
  verein?: string;
  landesverband?: string;
  game_operation_id?: number;
  lizenzstufe?: string;
  gueltigkeit?: string;
  active?: boolean;
  zusatzqualifikation?: string;
  gueltigkeit_z?: string;
}

export interface RefereeAdminGame {
  id: number;
  game_number: string;
  date: string;
  home_team: string;
  guest_team: string;
  league: string;
  season_id: number;
  result?: string;
  referee1?: string;
  referee2?: string;
}
