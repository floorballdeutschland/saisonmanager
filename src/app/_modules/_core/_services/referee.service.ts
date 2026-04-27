import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  RefereeAdmin,
  RefereeAdminGame,
  RefereeEntry,
  RefereeProfile,
  RefereePublicLicense,
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
      {
        referee: data,
      }
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

  public adminGetIncorrectAssignments(seasonId?: number) {
    const query = seasonId ? `?season_id=${seasonId}` : '';
    return this.http.get<RefereeAdminGame[]>(
      environment.apiURL + 'admin/referees/incorrect_assignments' + query
    );
  }
}
