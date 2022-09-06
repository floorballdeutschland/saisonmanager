export interface Player {
  id: number;
  last_name: string;
  first_name: string;
  birthdate: string;
  male: boolean;
  nation_id: number;
  club_id?: number;
}
