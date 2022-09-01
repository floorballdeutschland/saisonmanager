export interface User {
  id: number;
  email: string;
  username: string;
  name: string;
  permissions: { [key: string]: boolean }; // TODO: type this later
}

export interface LoginAnswer {
  success: boolean;
  user: User;
}
