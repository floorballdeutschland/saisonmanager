export interface GameFlags {
  started: boolean;
  ended: boolean;
  time_keeper_signed: boolean;
  record_keeper_signed: boolean;
  referee1_signed: boolean;
  referee2_signed: boolean;
  protest: boolean;
  special_event: boolean;
  playoff: boolean;
  overtime: boolean;
  home_captain_signed: boolean;
  guest_captain_signed: boolean;
}
