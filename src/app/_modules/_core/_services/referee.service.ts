import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  AssignmentClub,
  ClubAssignmentResult,
  ExclusionClub,
  PublicLicenseList,
  RefereeAdmin,
  RefereeAdminGame,
  RefereeAssignableGame,
  RefereeAssignment,
  RefereeAssignmentAvailable,
  RefereeAvailability,
  RefereeAvailabilityBulkResult,
  RefereeAvailabilityEntry,
  RefereeBulkUserResult,
  RefereeClubExclusionPayload,
  RefereeClubExclusionRequest,
  RefereeEmailImportReport,
  RefereeEntry,
  RefereeCourseResultSummary,
  RefereeGameDay,
  RefereeGameNotes,
  RefereeHistorySeason,
  PenaltyCode,
  RefereeLicenseLevel,
  RefereeMissingUserCount,
  RefereeProfile,
  RefereePublicLicense,
  RefereeQualificationType,
  RefereeStatusFilter,
  RefereeTag,
  RefereeVm,
  RefereeFeedbackProfileResponse,
} from '@floorball/types';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class RefereeService {
  constructor(private http: HttpClient) {}

  public getLicense(lizenznummer: number) {
    return this.http.get<RefereePublicLicense>(
      environment.apiURL + 'user/referees/' + lizenznummer
    );
  }

  public search(q: string) {
    const path =
      environment.apiURL + 'referees/search.json?q=' + encodeURIComponent(q);
    return this.http.get<RefereeEntry[]>(path);
  }

  // Self-service endpoints (logged-in referee)

  public getProfile() {
    return this.http.get<RefereeProfile>(
      environment.apiURL + 'referee/profile'
    );
  }

  public updateProfile(data: Partial<RefereeProfile>) {
    return this.http.put<RefereeProfile>(
      environment.apiURL + 'referee/profile',
      { referee: data }
    );
  }

  // Vereins-Ausschlussliste (Schiri-Selfservice). Die Liste selbst kommt mit
  // dem Profil; hier laufen nur die Anträge und die Vereinsauswahl.

  public getExclusionClubs() {
    return this.http.get<ExclusionClub[]>(environment.apiURL + 'referee/clubs');
  }

  public createClubExclusionRequest(data: {
    club_id: number;
    kind: 'add' | 'remove';
    reason: string;
  }) {
    return this.http.post<RefereeClubExclusionPayload>(
      environment.apiURL + 'referee/club_exclusions/requests',
      { exclusion_request: data }
    );
  }

  public withdrawClubExclusionRequest(id: number) {
    return this.http.delete<RefereeClubExclusionPayload>(
      environment.apiURL + 'referee/club_exclusions/requests/' + id
    );
  }

  // Admin endpoints

  public adminGetClubExclusionRequests(status = 'pending') {
    return this.http.get<RefereeClubExclusionRequest[]>(
      environment.apiURL +
        'admin/referee_club_exclusion_requests?status=' +
        encodeURIComponent(status)
    );
  }

  public adminApproveClubExclusionRequest(id: number, decisionNote?: string) {
    return this.http.post<RefereeClubExclusionRequest>(
      environment.apiURL +
        'admin/referee_club_exclusion_requests/' +
        id +
        '/approve',
      { decision_note: decisionNote }
    );
  }

  public adminRejectClubExclusionRequest(id: number, decisionNote: string) {
    return this.http.post<RefereeClubExclusionRequest>(
      environment.apiURL +
        'admin/referee_club_exclusion_requests/' +
        id +
        '/reject',
      { decision_note: decisionNote }
    );
  }

  public adminGetExclusionClubs() {
    return this.http.get<ExclusionClub[]>(
      environment.apiURL + 'admin/referee_club_exclusions/clubs'
    );
  }

  public adminGetRefereeClubExclusions(refereeId: number) {
    return this.http.get<RefereeClubExclusionPayload>(
      environment.apiURL + 'admin/referees/' + refereeId + '/club_exclusions'
    );
  }

  public adminCreateRefereeClubExclusion(
    refereeId: number,
    data: { club_id: number; reason: string }
  ) {
    return this.http.post<RefereeClubExclusionPayload>(
      environment.apiURL + 'admin/referees/' + refereeId + '/club_exclusions',
      { exclusion: data }
    );
  }

  public adminDeleteRefereeClubExclusion(refereeId: number, id: number) {
    return this.http.delete<RefereeClubExclusionPayload>(
      environment.apiURL +
        'admin/referees/' +
        refereeId +
        '/club_exclusions/' +
        id
    );
  }

  /**
   * Ohne `status` liefert die API alles außer den Schiedsrichtern mit beendeter
   * Karriere. Eine reine Zahl in `q` durchsticht diesen Standard, damit sich
   * eine alte Lizenznummer gezielt prüfen lässt.
   */
  public adminGetAll(params?: {
    q?: string;
    landesverband?: string;
    lizenzstufe?: string;
    active?: boolean;
    status?: RefereeStatusFilter;
    sort?: 'name' | 'lizenznummer';
    sort_dir?: 'asc' | 'desc';
  }) {
    let query = '';
    if (params) {
      const parts: string[] = [];
      if (params.q) parts.push(`q=${encodeURIComponent(params.q)}`);
      if (params.landesverband)
        parts.push(`landesverband=${encodeURIComponent(params.landesverband)}`);
      if (params.lizenzstufe)
        parts.push(`lizenzstufe=${encodeURIComponent(params.lizenzstufe)}`);
      if (params.active) parts.push('active=true');
      if (params.status) parts.push(`status=${params.status}`);
      if (params.sort) parts.push(`sort=${params.sort}`);
      if (params.sort_dir) parts.push(`sort_dir=${params.sort_dir}`);
      if (parts.length) query = '?' + parts.join('&');
    }
    return this.http.get<RefereeAdmin[]>(
      environment.apiURL + 'admin/referees' + query
    );
  }

  public adminGetById(id: number) {
    return this.http.get<RefereeAdmin>(
      environment.apiURL + 'admin/referees/' + id
    );
  }

  public adminCreate(referee: Partial<RefereeAdmin>) {
    return this.http.post<RefereeAdmin>(environment.apiURL + 'admin/referees', {
      referee,
    });
  }

  public adminUpdate(id: number, referee: Partial<RefereeAdmin>) {
    return this.http.put<RefereeAdmin>(
      environment.apiURL + 'admin/referees/' + id,
      { referee }
    );
  }

  public adminDelete(id: number) {
    return this.http.delete(environment.apiURL + 'admin/referees/' + id);
  }

  public adminMerge(masterId: number, secondaryId: number) {
    return this.http.post<{ message: string; master_id: number }>(
      environment.apiURL + 'admin/referees/' + masterId + '/merge',
      { secondary_id: secondaryId }
    );
  }

  public adminGetGames(id: number, seasonId?: number) {
    const query = seasonId ? `?season_id=${seasonId}` : '';
    return this.http.get<RefereeAdminGame[]>(
      environment.apiURL + 'admin/referees/' + id + '/games' + query
    );
  }

  // Schiri-Feedback der Vereine (nur Admin/FD-RSK/FD-Ansetzer).
  public adminGetFeedbacks(id: number) {
    return this.http.get<RefereeFeedbackProfileResponse>(
      environment.apiURL + 'admin/referees/' + id + '/feedbacks'
    );
  }

  public adminCreateUserAccount(id: number) {
    return this.http.post<RefereeAdmin>(
      environment.apiURL + 'admin/referees/' + id + '/create_user',
      {}
    );
  }

  public adminDeleteUserAccount(id: number) {
    return this.http.delete<RefereeAdmin>(
      environment.apiURL + 'admin/referees/' + id + '/destroy_user'
    );
  }

  // CSV mit den Spalten "Lizenznummer" und "E-Mailadresse". Traegt die Adressen
  // nur dort ein, wo im Profil noch keine steht (Admin).
  public adminImportEmails(file: File) {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<RefereeEmailImportReport>(
      environment.apiURL + 'admin/referees/import_emails',
      form
    );
  }

  // Wie viele Schiedsrichter haben eine Adresse, aber noch kein Konto (Admin).
  public adminGetMissingUserCount() {
    return this.http.get<RefereeMissingUserCount>(
      environment.apiURL + 'admin/referees/missing_user_count'
    );
  }

  // Legt die naechste Tranche fehlender Benutzerkonten an (Admin). Die API
  // begrenzt je Aufruf; was offen bleibt, steht in `remaining`.
  public adminCreateMissingUsers() {
    return this.http.post<RefereeBulkUserResult>(
      environment.apiURL + 'admin/referees/create_missing_users',
      {}
    );
  }

  public adminGetNextLizenznummer() {
    return this.http.get<{ next_lizenznummer: number }>(
      environment.apiURL + 'admin/referees/next_lizenznummer'
    );
  }

  public adminGetIncorrectAssignments(seasonId?: number) {
    const query = seasonId ? `?season_id=${seasonId}` : '';
    return this.http.get<RefereeAdminGame[]>(
      environment.apiURL + 'admin/referees/incorrect_assignments' + query
    );
  }

  // Qualification types (admin/RSK)

  public adminGetQualificationTypes() {
    return this.http.get<RefereeQualificationType[]>(
      environment.apiURL + 'admin/referee_qualification_types'
    );
  }

  public adminCreateQualificationType(data: Partial<RefereeQualificationType>) {
    return this.http.post<RefereeQualificationType>(
      environment.apiURL + 'admin/referee_qualification_types',
      { referee_qualification_type: data }
    );
  }

  public adminUpdateQualificationType(
    id: number,
    data: Partial<RefereeQualificationType>
  ) {
    return this.http.put<RefereeQualificationType>(
      environment.apiURL + 'admin/referee_qualification_types/' + id,
      { referee_qualification_type: data }
    );
  }

  public adminDeleteQualificationType(id: number) {
    return this.http.delete(
      environment.apiURL + 'admin/referee_qualification_types/' + id
    );
  }

  // Tags (admin/RSK/Ansetzer) – frei definierbarer Tag-Katalog, pro Spielbetrieb
  // gescopt. Zur Kategorisierung & Vorfilterung von Schiedsrichtern.

  public adminGetTags() {
    return this.http.get<RefereeTag[]>(
      environment.apiURL + 'admin/referee_tags'
    );
  }

  public adminCreateTag(data: Partial<RefereeTag>) {
    return this.http.post<RefereeTag>(
      environment.apiURL + 'admin/referee_tags',
      { referee_tag: data }
    );
  }

  public adminUpdateTag(id: number, data: Partial<RefereeTag>) {
    return this.http.put<RefereeTag>(
      environment.apiURL + 'admin/referee_tags/' + id,
      { referee_tag: data }
    );
  }

  public adminDeleteTag(id: number) {
    return this.http.delete(environment.apiURL + 'admin/referee_tags/' + id);
  }

  // License levels (admin/RSK)

  public adminGetLicenseLevels() {
    return this.http.get<RefereeLicenseLevel[]>(
      environment.apiURL + 'admin/referee_license_levels'
    );
  }

  public adminCreateLicenseLevel(data: Partial<RefereeLicenseLevel>) {
    return this.http.post<RefereeLicenseLevel>(
      environment.apiURL + 'admin/referee_license_levels',
      { referee_license_level: data }
    );
  }

  public adminUpdateLicenseLevel(
    id: number,
    data: Partial<RefereeLicenseLevel>
  ) {
    return this.http.put<RefereeLicenseLevel>(
      environment.apiURL + 'admin/referee_license_levels/' + id,
      { referee_license_level: data }
    );
  }

  public adminDeleteLicenseLevel(id: number) {
    return this.http.delete(
      environment.apiURL + 'admin/referee_license_levels/' + id
    );
  }

  // Penalty codes (admin)

  public adminGetPenaltyCodes() {
    return this.http.get<PenaltyCode[]>(
      environment.apiURL + 'admin/penalty_codes'
    );
  }

  public adminCreatePenaltyCode(data: Partial<PenaltyCode>) {
    return this.http.post<PenaltyCode>(
      environment.apiURL + 'admin/penalty_codes',
      { penalty_code: data }
    );
  }

  public adminUpdatePenaltyCode(id: string, data: Partial<PenaltyCode>) {
    return this.http.put<PenaltyCode>(
      environment.apiURL + 'admin/penalty_codes/' + id,
      { penalty_code: data }
    );
  }

  public adminDeletePenaltyCode(id: string) {
    return this.http.delete(environment.apiURL + 'admin/penalty_codes/' + id);
  }

  // Assignment endpoints (admin/RSK)

  public adminGetAssignments(params?: {
    season_id?: string;
    date_from?: string;
    date_to?: string;
    game_operation_id?: string;
  }) {
    const parts: string[] = [];
    if (params?.season_id)
      parts.push(`season_id=${encodeURIComponent(params.season_id)}`);
    if (params?.date_from)
      parts.push(`date_from=${encodeURIComponent(params.date_from)}`);
    if (params?.date_to)
      parts.push(`date_to=${encodeURIComponent(params.date_to)}`);
    if (params?.game_operation_id)
      parts.push(
        `game_operation_id=${encodeURIComponent(params.game_operation_id)}`
      );
    const query = parts.length ? '?' + parts.join('&') : '';
    return this.http.get<RefereeAssignment[]>(
      environment.apiURL + 'admin/referee_assignments' + query
    );
  }

  public adminGetAssignableGames(params?: {
    season_id?: string;
    date_from?: string;
    date_to?: string;
  }) {
    const parts: string[] = [];
    if (params?.season_id)
      parts.push(`season_id=${encodeURIComponent(params.season_id)}`);
    if (params?.date_from)
      parts.push(`date_from=${encodeURIComponent(params.date_from)}`);
    if (params?.date_to)
      parts.push(`date_to=${encodeURIComponent(params.date_to)}`);
    const query = parts.length ? '?' + parts.join('&') : '';
    return this.http.get<RefereeAssignableGame[]>(
      environment.apiURL + 'admin/referee_assignments/games' + query
    );
  }

  public adminCreateAssignment(data: {
    game_id: number;
    referee1_id?: number | null;
    referee2_id?: number | null;
    coach_id?: number | null;
    club_id?: number | null;
  }) {
    return this.http.post<RefereeAssignment>(
      environment.apiURL + 'admin/referee_assignments',
      { assignment: data }
    );
  }

  public adminUpdateAssignment(
    id: number,
    data: {
      game_id?: number;
      referee1_id?: number | null;
      referee2_id?: number | null;
      coach_id?: number | null;
      club_id?: number | null;
    }
  ) {
    return this.http.put<RefereeAssignment>(
      environment.apiURL + 'admin/referee_assignments/' + id,
      { assignment: data }
    );
  }

  // Zusätzliche Spielinformationen des Ansetzers. Leerer Text löscht den
  // Hinweis. Sichtbar nur für die Ansetzung und – nach dem Veröffentlichen –
  // für das angesetzte Gespann und den SR-Coach.
  public adminUpdateGameRefereeNotes(gameId: number, notes: string) {
    return this.http.patch<RefereeGameNotes>(
      environment.apiURL +
        'admin/referee_assignments/games/' +
        gameId +
        '/notes',
      { game: { referee_notes: notes } }
    );
  }

  // Vereine, die als „angesetzter Verein" gewählt werden können (eigener LV +
  // geteilte LV; Admin = alle).
  public adminGetAssignmentClubs() {
    return this.http.get<AssignmentClub[]>(
      environment.apiURL + 'admin/referee_assignments/clubs'
    );
  }

  // Reduzierter Modus (Weg 3): Vereine der Mannschaften dieser Liga. Die
  // LV-weite Liste aus adminGetAssignmentClubs wäre hier ein Heuhaufen.
  public adminGetLeagueAssignmentClubs(leagueId: number) {
    return this.http.get<AssignmentClub[]>(
      environment.apiURL +
        'admin/referee_assignments/league_clubs?league_id=' +
        leagueId
    );
  }

  // Reduzierter Modus (Weg 3): entweder einen Verein benennen, der das Gespann
  // stellt, oder Personen/Paare als Freitext. Beides steht sofort im Spielplan.
  public adminUpdateClubAssignment(
    gameId: number,
    data: { club_id?: number | null; nominated_referee_string?: string }
  ) {
    return this.http.patch<ClubAssignmentResult>(
      environment.apiURL +
        'admin/referee_assignments/games/' +
        gameId +
        '/club_assignment',
      data
    );
  }

  public adminPublishAssignment(id: number) {
    return this.http.post<RefereeAssignment>(
      environment.apiURL + 'admin/referee_assignments/' + id + '/publish',
      {}
    );
  }

  public adminNotifyAssignment(id: number) {
    return this.http.post<RefereeAssignment>(
      environment.apiURL + 'admin/referee_assignments/' + id + '/notify',
      {}
    );
  }

  public adminGetAvailableReferees(date: string, gameId?: number) {
    let query = `?date=${encodeURIComponent(date)}`;
    if (gameId) query += `&game_id=${gameId}`;
    return this.http.get<RefereeAssignmentAvailable[]>(
      environment.apiURL + 'admin/referee_assignments/available' + query
    );
  }

  // Mögliche Schiedsrichtercoaches (gültige B-Zusatzlizenz, Verfügbarkeit am Tag).
  public adminGetAvailableCoaches(date: string) {
    const query = `?date=${encodeURIComponent(date)}`;
    return this.http.get<RefereeAssignmentAvailable[]>(
      environment.apiURL + 'admin/referee_assignments/available_coaches' + query
    );
  }

  // Wochenend-Verfügbarkeitsmatrix („war room") für die Ansetzung.
  public adminGetAvailability(params?: {
    season_id?: string;
    date_from?: string;
    date_to?: string;
  }) {
    const parts: string[] = [];
    if (params?.season_id)
      parts.push(`season_id=${encodeURIComponent(params.season_id)}`);
    if (params?.date_from)
      parts.push(`date_from=${encodeURIComponent(params.date_from)}`);
    if (params?.date_to)
      parts.push(`date_to=${encodeURIComponent(params.date_to)}`);
    const query = parts.length ? '?' + parts.join('&') : '';
    return this.http.get<RefereeAvailability>(
      environment.apiURL + 'admin/referee_assignments/availability' + query
    );
  }

  // Availabilities (self-service for logged-in referee)

  public getAvailabilities(params?: { date_from?: string; date_to?: string }) {
    let query = '';
    if (params) {
      const parts: string[] = [];
      if (params.date_from) parts.push(`date_from=${params.date_from}`);
      if (params.date_to) parts.push(`date_to=${params.date_to}`);
      if (parts.length) query = '?' + parts.join('&');
    }
    return this.http.get<RefereeAvailabilityEntry[]>(
      environment.apiURL + 'referee/availabilities' + query
    );
  }

  public createAvailability(date: string) {
    return this.http.post<RefereeAvailabilityEntry>(
      environment.apiURL + 'referee/availabilities',
      { availability: { date } }
    );
  }

  public createAvailabilitiesBulk(dates: string[]) {
    return this.http.post<RefereeAvailabilityBulkResult>(
      environment.apiURL + 'referee/availabilities/bulk',
      { dates }
    );
  }

  public deleteAvailability(id: number) {
    return this.http.delete(
      environment.apiURL + 'referee/availabilities/' + id
    );
  }

  // Game day confirmations (self-service for logged-in referee)

  public getGameDays() {
    return this.http.get<RefereeGameDay[]>(
      environment.apiURL + 'referee/game_days'
    );
  }

  public confirmGameDay(
    gameDayId: number,
    body: {
      properly_conducted: boolean;
      answers?: { item_id: number; answer: boolean }[];
    } = { properly_conducted: true }
  ) {
    return this.http.post<{
      confirmed_at: string;
      properly_conducted: boolean;
      checklist_answers: {
        item_id: number;
        question: string;
        answer: boolean;
      }[];
    }>(
      environment.apiURL + 'referee/game_days/' + gameDayId + '/confirm',
      body
    );
  }

  // Public license list (token-based, no auth)

  public getPublicLicenseList(token: string) {
    return this.http.get<PublicLicenseList>(
      environment.apiURL +
        'public/license_list?token=' +
        encodeURIComponent(token)
    );
  }

  // History (self-service)

  public getHistoryGames() {
    return this.http.get<RefereeHistorySeason[]>(
      environment.apiURL + 'referee/history/games'
    );
  }

  public getHistoryTests() {
    return this.http.get<RefereeCourseResultSummary[]>(
      environment.apiURL + 'referee/history/tests'
    );
  }

  // VM endpoint

  public vmGetReferees() {
    return this.http.get<RefereeVm[]>(environment.apiURL + 'vm/referees');
  }
}
