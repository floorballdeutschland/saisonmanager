import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { Club, ClubWithTeams, LicenseHash, Team } from '@floorball/types';
import { GameOperationWithClubs } from 'src/app/_models/game-operation.interface';

@Injectable({
  providedIn: 'root',
})
export class ClubService {
  constructor(private http: HttpClient) {}

  //
  // admin routes
  //
  public getAdminClubs() {
    const path = environment.apiURL + 'admin/clubs.json';
    return this.http.get<GameOperationWithClubs[]>(path);
  }

  public getAdminClub(clubId: number) {
    const path = environment.apiURL + 'admin/clubs/' + clubId + '.json';
    return this.http.get<Club>(path);
  }

  public getAdminTeam(teamId: number) {
    const path = environment.apiURL + 'admin/teams/' + teamId + '.json';
    return this.http.get<Team>(path);
  }

  public getAdminClubAll() {
    const path = environment.apiURL + 'admin/clubs/all.json';
    return this.http.get<Club[]>(path);
  }

  public adminCreateClub(club: Club) {
    const path = environment.apiURL + 'admin/clubs.json';
    return this.http.post<Club>(path, club);
  }

  public uploadClubLogo(clubId: number, file: File) {
    const path =
      environment.apiURL + 'admin/clubs/' + clubId + '/upload_logo.json';
    const formData = new FormData();
    formData.append('logo', file);
    return this.http.post<{ logo_url: string; logo_small_url: string }>(
      path,
      formData
    );
  }

  public uploadTeamLogo(teamId: number, file: File) {
    const path =
      environment.apiURL + 'admin/teams/' + teamId + '/upload_logo.json';
    const formData = new FormData();
    formData.append('logo', file);
    return this.http.post<{ logo_url: string; logo_small_url: string }>(
      path,
      formData
    );
  }

  public adminGetClubAndTeams() {
    const path = environment.apiURL + 'user/clubs_and_teams.json';
    return this.http.get<ClubWithTeams[]>(path);
  }

  public userGetTeamLicenses(teamId: number) {
    const path = environment.apiURL + 'user/team/' + teamId + '/licenses.json';
    return this.http.get<LicenseHash>(path);
  }

  public userCreateLicenseRequest(playerId: number, teamId: number) {
    const path =
      environment.apiURL + 'user/players/' + playerId + '/request_license.json';
    return this.http.post<{ success: boolean }>(path, { team_id: teamId });
  }

  public userWithdrawLicenseRequest(playerId: number, licenseId: string) {
    const path =
      environment.apiURL +
      'user/players/' +
      playerId +
      '/withdraw_license.json';
    return this.http.post<{ success: boolean }>(path, {
      license_id: licenseId,
    });
  }
}
