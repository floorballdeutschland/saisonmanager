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
}
