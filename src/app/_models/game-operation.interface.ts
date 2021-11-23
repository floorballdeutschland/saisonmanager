export interface GameOperation {
  id: number;
  name: string;
  short_name: string;
  path: string;
  logo_url?: string | null;
  logo_quad_url?: string | null;
}
