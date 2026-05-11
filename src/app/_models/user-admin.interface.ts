export interface UserAdminRole {
  user_group_id: number;
  role_name: string;
  club_id: number | null;
  game_operation_id: number | null;
}

export interface UserAdminEntry {
  id: number;
  username: string;
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  club_id: number | null;
  active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  roles: UserAdminRole[];
  teams?: number[];
}
