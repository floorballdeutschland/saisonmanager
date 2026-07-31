import { Club } from './club.interface';
import { League } from './league.interface';

export interface GameOperation {
  id: number;
  name: string;
  short_name: string;
  path: string;
  // Kommt ausschließlich aus dem Logo-Upload des Landesverbands und ist ohne
  // hinterlegtes Logo nicht gesetzt (siehe saisonmanager-api#276).
  logo_url?: string;
  banner_url?: string | null;
  banner_link_url?: string | null;
  top_leagues: League[];
  scan_required?: boolean;
  state_association_id?: number | null;
}

export interface GameOperationWithLeagues extends GameOperation {
  leagues: League[];
}

export interface GameOperationWithClubs extends GameOperation {
  clubs: Club[];
  released?: boolean;
}
