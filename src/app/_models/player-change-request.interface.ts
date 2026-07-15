export type CorrectionType =
  | 'birthdate'
  | 'first_name'
  | 'last_name'
  | 'names_swapped'
  | 'nationality'
  | 'gender'
  | 'merge';

export type ChangeRequestStatus = 'pending' | 'approved' | 'rejected';

export interface PlayerChangeRequest {
  id: number;
  correction_type: CorrectionType;
  new_value: string | null;
  status: ChangeRequestStatus;
  rejection_reason: string | null;
  created_at: string;
  player: {
    id: number;
    first_name: string;
    last_name: string;
    birthdate: string;
    nation_id: number;
  };
  club: { id: number; name: string };
  // Nur bei correction_type 'merge': das Duplikat, das in `player` aufgehen soll.
  secondary_player: {
    id: number;
    first_name: string;
    last_name: string;
    birthdate: string;
    deactivated_at: string | null;
  } | null;
  requested_by_user_id: number;
  reviewed_by_user_id: number | null;
}
