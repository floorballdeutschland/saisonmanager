import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import {
  Club,
  LicenseDocument,
  Nation,
  Player,
  PlayerSearchResult,
  PlayerStats,
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

  public getPlayer(playerId: number) {
    const path = environment.apiURL + 'admin/players/' + playerId + '.json';
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

  public adminTransferPlayer(playerId: number, clubId: string) {
    const path =
      environment.apiURL + 'admin/players/' + playerId + '/transfer.json';
    return this.http.post<Player>(path, {
      player_id: playerId,
      club_id: parseInt(clubId, 10),
    });
  }

  public updateLicenseStatus(
    playerId: number,
    licenseId: string,
    licenseStatusId: number,
    reason: string
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
    });
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

  public deactivatePlayer(playerId: number) {
    const path =
      environment.apiURL + 'admin/players/' + playerId + '/deactivate.json';
    return this.http.post<Player>(path, {});
  }

  public getLicenseDocuments(playerId: number, licenseId: string) {
    const path =
      environment.apiURL +
      'admin/players/' +
      playerId +
      '/license_documents.json?license_id=' +
      encodeURIComponent(licenseId);
    return this.http.get<LicenseDocument[]>(path);
  }

  public uploadLicenseDocument(
    playerId: number,
    licenseId: string,
    documentType: 'id_copy' | 'parental_consent',
    file: File
  ) {
    const path =
      environment.apiURL +
      'admin/players/' +
      playerId +
      '/license_documents.json';
    const formData = new FormData();
    formData.append('license_id', licenseId);
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
