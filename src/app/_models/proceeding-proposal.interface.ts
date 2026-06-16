export interface ProceedingProposalReport {
  filename: string;
  url: string;
}

export interface ProceedingProposal {
  id: number;
  status: string;
  created_at: string;
  game_id: number;
  game_number: string | null;
  game_date: string | null;
  home_team: string;
  guest_team: string;
  league_name: string;
  state_association_id: number;
  decided_at?: string | null;
  report?: ProceedingProposalReport | null;
}
