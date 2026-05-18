import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  PublicLicenseList,
  RefereeAdmin,
  RefereeAdminGame,
  RefereeAssignableGame,
  RefereeAssignment,
  RefereeAssignmentAvailable,
  RefereeBlockedDate,
  RefereeEntry,
  RefereeProfile,
  RefereePublicLicense,
  RefereeQualificationType,
  RefereeVm,
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

  // Admin endpoints

  public adminGetAll(params?: {
    q?: string;
    landesverband?: string;
    lizenzstufe?: string;
    active?: boolean;
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

  public adminGetGames(id: number, seasonId?: number) {
    const query = seasonId ? `?season_id=${seasonId}` : '';
    return this.http.get<RefereeAdminGame[]>(
      environment.apiURL + 'admin/referees/' + id + '/games' + query
    );
  }

  public adminCreateWalletPass(id: number) {
    return this.http.post<{ url: string }>(
      environment.apiURL + 'admin/referees/' + id + '/wallet_pass',
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
    }
  ) {
    return this.http.put<RefereeAssignment>(
      environment.apiURL + 'admin/referee_assignments/' + id,
      { assignment: data }
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

  // Blocked dates (self-service for logged-in referee)

  public getBlockedDates() {
    return this.http.get<RefereeBlockedDate[]>(
      environment.apiURL + 'referee/blocked_dates'
    );
  }

  public createBlockedDate(date: string) {
    return this.http.post<RefereeBlockedDate>(
      environment.apiURL + 'referee/blocked_dates',
      { blocked_date: { date } }
    );
  }

  public deleteBlockedDate(id: number) {
    return this.http.delete(environment.apiURL + 'referee/blocked_dates/' + id);
  }

  // Public license list (token-based, no auth)

  public getPublicLicenseList(token: string) {
    return this.http.get<PublicLicenseList>(
      environment.apiURL +
        'public/license_list?token=' +
        encodeURIComponent(token)
    );
  }

  // VM endpoint

  public vmGetReferees() {
    return this.http.get<RefereeVm[]>(environment.apiURL + 'vm/referees');
  }
}
