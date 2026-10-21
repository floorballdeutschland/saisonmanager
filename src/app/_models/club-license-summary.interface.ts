// Antwort von GET vm/clubs/:id/license_summary. Jede Lizenz steht in genau
// einer der Zahlen, `total` ist ihre Summe. `approved` zaehlt auch Lizenzen,
// die spaeter geloescht oder durch einen Transfer ungueltig wurden.
export interface ClubLicenseCounts {
  approved: number;
  requested: number;
  denied: number;
  withdrawn: number;
  other: number;
  total: number;
}

export interface ClubLicenseSummaryTeam {
  id: number;
  name: string;
  league_name: string | null;
  counts: ClubLicenseCounts;
}

export interface ClubLicenseSummary {
  club: { id: number; name: string };
  season_id: number;
  seasons: { id: number; name: string }[];
  teams: ClubLicenseSummaryTeam[];
  totals: ClubLicenseCounts;
}
