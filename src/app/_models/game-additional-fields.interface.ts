export interface GameAdditionalFields {
  time_keeper_signed: boolean;
  record_keeper_signed: boolean;
  referee1_signed: boolean;
  referee2_signed: boolean;
  home_captain_signed: boolean;
  guest_captain_signed: boolean;
  protest: boolean;
  special_event: boolean;
  playoff: boolean;
  overtime: boolean;
  home_timeout_string: string;
  guest_timeout_string: string;
  time_keeper_string: string;
  record_keeper_string: string;
  home_team_coaches: Coach;
  guest_team_coaches: Coach;
  record_comment: string;
}

export interface Coach {
  coach1_first_name: string;
  coach1_last_name: string;
  coach1_string: string;
  coach2_first_name: string;
  coach2_last_name: string;
  coach2_string: string;
  coach3_first_name: string;
  coach3_last_name: string;
  coach3_string: string;
  coach4_first_name: string;
  coach4_last_name: string;
  coach4_string: string;
  coach5_first_name: string;
  coach5_last_name: string;
  coach5_string: string;
}
