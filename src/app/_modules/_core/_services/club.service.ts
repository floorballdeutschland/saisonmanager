import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import {
  Club,
  ClubManagerList,
  ClubWithTeams,
  LicenseHash,
  StateAssociationWithClubs,
  Team,
} from '@floorball/types';

@Injectable({
  providedIn: 'root',
})
export class ClubService {
  constructor(private http: HttpClient) {}

  //
  // admin routes
  //
  public getAdminClubs(includeDeactivated = false) {
    const path =
      environment.apiURL +
      'admin/clubs.json' +
      (includeDeactivated ? '?include_deactivated=true' : '');
    return this.http.get<StateAssociationWithClubs[]>(path);
  }

  public deactivateClub(clubId: number) {
    const path =
      environment.apiURL + 'admin/clubs/' + clubId + '/deactivate.json';
    return this.http.post<Club>(path, {});
  }

  public reactivateClub(clubId: number) {
    const path =
      environment.apiURL + 'admin/clubs/' + clubId + '/reactivate.json';
    return this.http.post<Club>(path, {});
  }

  public adminDeleteClub(clubId: number) {
    return this.http.delete(
      environment.apiURL + 'admin/clubs/' + clubId + '.json'
    );
  }

  public getAdminClub(clubId: number) {
    const path = environment.apiURL + 'admin/clubs/' + clubId + '.json';
    return this.http.get<Club>(path);
  }

  /**
   * Vereinsmanager des Vereins samt aktueller Auswahl. Eigener Endpunkt, weil
   * der Vereins-Datensatz serverseitig in jeder Spieltags-Antwort mitreist.
   */
  public getClubManagers(clubId: number) {
    const path =
      environment.apiURL + 'admin/clubs/' + clubId + '/managers.json';
    return this.http.get<ClubManagerList>(path);
  }

  public getAdminTeam(teamId: number) {
    const path = environment.apiURL + 'admin/teams/' + teamId + '.json';
    return this.http.get<Team>(path);
  }

  /**
   * Schlanke Vereinsliste über alle Landesverbände hinweg – im Gegensatz zu
   * getAdminClubs() nicht auf den eigenen Zuständigkeitsbereich eingegrenzt.
   *
   * activeOnly für Masken, die einen Verein *neu* zuweisen: Dort darf ein
   * deaktivierter Verein nicht auswählbar sein. Standard bleibt die
   * vollständige Liste, damit Anzeige-Aufrufer Bestandsdaten (alte
   * Mitgliedschaften, Spieltage) weiter benennen können. Achtung: Von den
   * Bestandsaufrufern setzt noch keiner den Parameter, obwohl Spielerprofil,
   * Schiri- und Spieltagsmaske ebenfalls zuweisen — dort stehen deaktivierte
   * Vereine also weiterhin in der Auswahl.
   */
  public getAdminClubAll(activeOnly = false) {
    const path =
      environment.apiURL +
      'admin/clubs/all.json' +
      (activeOnly ? '?active_only=true' : '');
    return this.http.get<Club[]>(path);
  }

  /**
   * Vereine, für die der angemeldete User vereinsgebundene Rollen (VM/TM)
   * vergeben darf – im Gegensatz zu getAdminClubAll() auf den eigenen
   * Zuständigkeitsbereich eingegrenzt. Die API nutzt für diesen Endpunkt
   * dieselbe Quelle wie die Prüfung beim Anlegen, es werden also nur Vereine
   * geliefert, für die das Speichern auch durchgeht.
   */
  public getRoleAssignableClubs() {
    const path = environment.apiURL + 'admin/clubs/role_assignable.json';
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

  // Nur die Vereine, für die man VM oder TM ist – ohne die Vereine, die eine
  // zusätzliche Admin-/SBK-Rolle beisteuern würde. Für die Vereinssicht
  // („Meine Spieler*innen"), die genau diesen Bestand meint.
  public vmGetClubAndTeams() {
    const path = environment.apiURL + 'vm/clubs_and_teams.json';
    return this.http.get<ClubWithTeams[]>(path);
  }

  public userGetTeamLicenses(teamId: number) {
    const path = environment.apiURL + 'user/team/' + teamId + '/licenses.json';
    return this.http.get<LicenseHash>(path);
  }

  public userCreateLicenseRequest(
    playerId: number,
    teamId: number,
    express = false,
    guardianEmail?: string,
    minorConsentAt?: string
  ) {
    const path =
      environment.apiURL + 'user/players/' + playerId + '/request_license.json';
    const body: Record<string, unknown> = { team_id: teamId, express };
    if (guardianEmail) body['guardian_email'] = guardianEmail;
    if (minorConsentAt) body['minor_consent_at'] = minorConsentAt;
    return this.http.post<{ success: boolean }>(path, body);
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
