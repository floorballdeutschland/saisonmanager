import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import {
  Club,
  GfRole,
  LicenseDocument,
  Nation,
  Player,
  PlayerSearchResult,
  PlayerStats,
  PlayerSuspension,
} from '@floorball/types';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class PlayerService {
  constructor(private http: HttpClient) {}

  public getClubPlayers(clubId: number) {
    const path = environment.apiURL + 'admin/clubs/' + clubId + '/players.json';
    return this.http.get<Club>(path);
  }

  public getPlayer(playerId: number, allLicenses = false) {
    const query = allLicenses ? '?all_licenses=true' : '';
    const path =
      environment.apiURL + 'admin/players/' + playerId + '.json' + query;
    return this.http.get<Player>(path);
  }

  public getPlayerStats(playerId: number) {
    const path = environment.apiURL + 'players/' + playerId + '/stats.json';
    return this.http.get<PlayerStats>(path);
  }

  public getNations() {
    const path = environment.apiURL + 'user/players/nations.json';
    return this.http.get<Nation[]>(path);
  }

  public adminCreateOrUpdatePlayer(player: Player) {
    const path = environment.apiURL + 'admin/players.json';
    return this.http.post<Player>(path, player);
  }

  public adminAddAdditionalClub(playerId: number, clubId: string) {
    const path =
      environment.apiURL +
      'admin/players/' +
      playerId +
      '/add_additional_club.json';
    return this.http.post<Player>(path, {
      player_id: playerId,
      club_id: parseInt(clubId, 10),
    });
  }

  public adminRemoveAdditionalClub(
    playerId: number,
    clubId: string,
    valid_until: string
  ) {
    const path =
      environment.apiURL +
      'admin/players/' +
      playerId +
      '/remove_additional_club.json';
    return this.http.post<Player>(path, {
      player_id: playerId,
      club_id: parseInt(clubId, 10),
      valid_until: valid_until,
    });
  }

  public updateLicenseStatus(
    playerId: number,
    licenseId: string,
    licenseStatusId: number,
    reason: string,
    validUntil?: string,
    gfRole?: GfRole
  ) {
    const path =
      environment.apiURL +
      'admin/players/' +
      playerId +
      '/handle_license_request.json';
    return this.http.post<Player>(path, {
      player_id: playerId,
      license_id: licenseId,
      license_status_id: licenseStatusId,
      reason: reason,
      ...(validUntil ? { valid_until: validUntil } : {}),
      ...(gfRole ? { gf_role: gfRole } : {}),
    });
  }

  // Setzt/tauscht die Erst-/Zweitlizenz-Zuordnung einer GF-Erwachsenen-Lizenz.
  // gfRole null entfernt die Zuordnung.
  public setGfLicenseRole(
    playerId: number,
    licenseId: string,
    gfRole: GfRole | null
  ) {
    const path =
      environment.apiURL +
      'admin/players/' +
      playerId +
      '/set_gf_license_role.json';
    return this.http.post<{ success: boolean }>(path, {
      license_id: licenseId,
      gf_role: gfRole ?? '',
    });
  }

  public getSuspensions(playerId: number) {
    const path =
      environment.apiURL + 'admin/players/' + playerId + '/suspensions.json';
    return this.http.get<PlayerSuspension[]>(path);
  }

  public createSuspension(
    playerId: number,
    payload: {
      team_id?: number | null;
      valid_from?: string | null;
      valid_until: string;
      reason?: string | null;
    }
  ) {
    const path =
      environment.apiURL + 'admin/players/' + playerId + '/suspensions.json';
    return this.http.post<PlayerSuspension>(path, payload);
  }

  public liftSuspension(playerId: number, suspensionId: number) {
    const path =
      environment.apiURL +
      'admin/players/' +
      playerId +
      '/suspensions/' +
      suspensionId +
      '.json';
    return this.http.delete<PlayerSuspension>(path);
  }

  public globalSearch(query: string) {
    const path =
      environment.apiURL +
      'admin/players/search.json?q=' +
      encodeURIComponent(query);
    return this.http.get<PlayerSearchResult[]>(path);
  }

  public reenableLicenseRequest(playerId: number, licenseId: string) {
    const path =
      environment.apiURL +
      'user/players/' +
      playerId +
      '/reenable_license_request.json';
    return this.http.post<Player>(path, {
      license_id: licenseId,
    });
  }

  public deactivatePlayer(playerId: number, reason?: string) {
    const path =
      environment.apiURL + 'admin/players/' + playerId + '/deactivate.json';
    return this.http.post<Player>(path, { reason: reason ?? null });
  }

  public updatePlayerEmail(playerId: number, email: string | null) {
    const path = environment.apiURL + 'admin/vm/players/' + playerId + '/email';
    return this.http.patch<{ id: number; email: string | null }>(path, {
      email,
    });
  }

  public reactivatePlayer(playerId: number) {
    const path =
      environment.apiURL + 'admin/players/' + playerId + '/reactivate.json';
    return this.http.post<Player>(path, {});
  }

  public mergePlayer(masterId: number, secondaryId: number) {
    const path =
      environment.apiURL + 'admin/players/' + masterId + '/merge.json';
    return this.http.post<{ message: string; master_id: number }>(path, {
      secondary_id: secondaryId,
    });
  }

  public vmGetPlayers(clubId: number) {
    const path = environment.apiURL + 'admin/vm/players.json?club_id=' + clubId;
    return this.http.get<Player[]>(path);
  }

  // Lizenz-Dokumente gelten pro Spieler (saisonübergreifend), nicht mehr pro
  // Lizenz.
  public getLicenseDocuments(playerId: number) {
    const path =
      environment.apiURL +
      'admin/players/' +
      playerId +
      '/license_documents.json';
    return this.http.get<LicenseDocument[]>(path);
  }

  public uploadLicenseDocument(
    playerId: number,
    documentType: string,
    file: File
  ) {
    const path =
      environment.apiURL +
      'admin/players/' +
      playerId +
      '/license_documents.json';
    const formData = new FormData();
    formData.append('document_type', documentType);
    formData.append('file', file);
    return this.http.post<LicenseDocument>(path, formData);
  }

  public deleteLicenseDocument(playerId: number, documentId: number) {
    const path =
      environment.apiURL +
      'admin/players/' +
      playerId +
      '/license_documents/' +
      documentId +
      '.json';
    return this.http.delete<{ success: boolean }>(path);
  }
}
