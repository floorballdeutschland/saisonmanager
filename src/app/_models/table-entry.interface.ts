export interface TablePointCorrections {
  points: number;
  reason: string;
  team_name: string;
  reference_number: string;
}

export interface GroupedTableEntry {
  group_identifier: string;
  name: string;
  table: TableEntry[];
}

export interface GroupedTable {
  [group_identifier: string]: GroupedTableEntry;
}

/**
 * Aus den Vorrunden-Ligen übernommene Werte (api, `preround_transfer_scope`).
 * Welche Felder vorkommen, hängt von der Stufe ab: nur `points`, dazu die
 * Tore, oder die komplette Bilanz.
 */
export interface TablePreroundTransfer {
  points?: number;
  goals_scored?: number;
  goals_received?: number;
  games?: number;
  won?: number;
  draw?: number;
  lost?: number;
  won_ot?: number;
  lost_ot?: number;
}

export interface TableEntry {
  games: number;
  won: number;
  draw: number;
  lost: number;
  won_ot: number;
  lost_ot: number;
  goals_scored: number;
  goals_received: number;
  goals_diff: number;
  points: number;
  team_name: string;
  team_id: number;
  team_logo: string;
  team_small_logo: string;
  point_corrections: TablePointCorrections;
  sort: number;
  position: number;
  has_direct_encounter_games?: boolean;
  /** Übernommene Vorrundenpunkte, schon in `points` enthalten. */
  preround_points?: number;
  /** Alle übernommenen Vorrundenwerte, schon in den Spalten enthalten. */
  preround?: TablePreroundTransfer;
  qualification_type?: string | null;
  qualification_label?: string | null;
}
