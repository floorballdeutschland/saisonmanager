export type LeagueQualificationType =
  | 'promotion'
  | 'playoff'
  | 'playdown'
  | 'relegation'
  | 'championship'
  | 'cup';

export interface LeagueQualification {
  id: number;
  rank_from: number;
  rank_to: number;
  qualification_type: LeagueQualificationType;
  label?: string | null;
  target_league_id?: number | null;
  target_league_name?: string | null;
}
