export interface UserAdminRole {
  user_group_id: number;
  role_name: string;
  club_id: number | null;
  club_name?: string | null;
  game_operation_id: number | null;
  game_operation_name?: string | null;
}

export interface UserAdminEntry {
  id: number;
  username: string;
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  club_id: number | null;
  archived_at: string | null;
  inactive?: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  roles: UserAdminRole[];
  teams?: number[];
  team_names?: string[];
  // Konto ist von der TM-Sperre betroffen und kann sich nicht anmelden. Kommt
  // aus der API (User#permissions_items), weil dort mehr einfließt als die
  // Team-Zuweisung und team_names nicht auf die aktuelle Saison gefiltert ist.
  login_blocked?: boolean;
}
