export interface User {
  id: number;
  email: string;
  username: string;
  name: string;
  permissions: { [key: string]: boolean };
  club_ids: number[];
}

export interface LoginAnswer {
  success: boolean;
  user: User;
}
