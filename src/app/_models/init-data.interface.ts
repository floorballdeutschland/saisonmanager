import { GameOperation, Season, StateAssociation } from '.';

export interface InitData {
  seasons: Season[];
  current_season_id: number;
  game_operations: GameOperation[];
  state_associations: StateAssociation[];
  // Gepflegte Links auf externe Informationsblätter, Key → Adresse. Enthält
  // nur Keys mit hinterlegter Adresse; fehlt einer, wird der Link nicht
  // angeboten. Kommt über init mit, weil auch Vereinsmanager die Adressen im
  // Lizenzantrag brauchen.
  info_links?: Record<string, string>;
}
