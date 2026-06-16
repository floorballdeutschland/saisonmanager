export interface User {
  id: number;
  email: string;
  username: string;
  name: string;
  permissions: { [key: string]: boolean };
  club_ids: number[];
  language?: 'de' | 'en';
  login_blocked_message?: string;
}

export interface LoginAnswer {
  success: boolean;
  user: User;
}
