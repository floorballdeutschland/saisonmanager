export type TransferRequestStatus =
  | 'pending_club'
  | 'pending_lv'
  | 'approved'
  | 'rejected_by_club'
  | 'rejected_by_lv';

export interface TransferRequestPlayer {
  id: number;
  first_name: string;
  last_name: string;
  birthdate: string;
}

export interface TransferRequestClub {
  id: number;
  name: string;
}

export interface TransferRequest {
  id: number;
  status: TransferRequestStatus;
  season_id: number;
  rejection_reason?: string;
  created_at: string;
  player: TransferRequestPlayer;
  requesting_club: TransferRequestClub;
  former_club: TransferRequestClub;
}
