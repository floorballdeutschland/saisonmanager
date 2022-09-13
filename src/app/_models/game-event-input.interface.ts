export interface GameEventInput {
  time: string;
  event_type: string;
  event_team: string;
  period: number;
  home_goals: number;
  guest_goals: number;
  home_number?: number;
  home_assist?: number;
  guest_number?: number;
  guest_assist?: number;
  penalty_id?: number;
  penalty_code_id?: number;
  goal_type?: string;
}
