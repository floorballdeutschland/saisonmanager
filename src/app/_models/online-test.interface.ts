export interface OnlineTestRow {
  id: number;
  label: string;
}

export interface OnlineTestSolutionRow {
  id: number;
  value: string;
}

export interface OnlineTestQuestion {
  id: number;
  position: number;
  scenario: string;
  rows: OnlineTestRow[];
  solution?: OnlineTestSolutionRow[];
}

export interface OnlineTest {
  id: number;
  name: string;
  lizenzstufe: string | null;
  time_limit_minutes: number | null;
  max_attempts: number;
  pass_threshold_points: number | null;
  deadline: string | null;
  status: 'draft' | 'published';
  question_count: number;
  questions?: OnlineTestQuestion[];
}

export interface OnlineTestAssignment {
  id: number;
  online_test_id: number;
  referee_id: number;
  referee_name: string;
  lizenznummer: string;
  lizenzstufe: string;
  assigned_at: string;
}

export interface OnlineTestAttemptSummary {
  id: number;
  attempt_number: number;
  status: 'in_progress' | 'completed';
  started_at: string;
  completed_at: string | null;
  error_points: number | null;
  passed: boolean | null;
}

export interface OnlineTestAnswerRow {
  id: number;
  selected: string;
}

export interface OnlineTestAnswer {
  question_id: number;
  rows: OnlineTestAnswerRow[];
}

export interface RefereeOnlineTestListItem {
  id: number;
  name: string;
  lizenzstufe: string | null;
  deadline: string | null;
  time_limit_minutes: number | null;
  max_attempts: number;
  attempt_count: number;
  has_in_progress: boolean;
  best_error_points: number | null;
  passed: boolean | null;
}

export interface RefereeOnlineTestDetail {
  test: {
    id: number;
    name: string;
    lizenzstufe: string | null;
    time_limit_minutes: number | null;
    max_attempts: number;
    deadline: string | null;
    penalty_options: string[];
  };
  attempts: OnlineTestAttemptSummary[];
  in_progress_attempt_id: number | null;
  can_start: boolean;
  results_visible: boolean;
  questions: OnlineTestQuestion[] | null;
}

export interface RefereeOnlineTestStartResponse {
  attempt_id: number;
  attempt_number: number;
  started_at: string;
  answers: OnlineTestAnswer[];
  questions: OnlineTestQuestion[];
  time_limit_minutes: number | null;
}

export interface OnlineTestResult {
  referee_id: number;
  nachname: string;
  vorname: string;
  lizenznummer: string;
  lizenzstufe: string;
  attempt_count: number;
  best_error_points: number | null;
  passed: boolean | null;
  attempts: OnlineTestAttemptSummary[];
}
