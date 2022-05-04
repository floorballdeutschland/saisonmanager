export interface User {
  id: number;
  email: string;
  username: string;
  name: string;
}

export interface LoginAnswer {
  success: boolean;
  user: User;
}
