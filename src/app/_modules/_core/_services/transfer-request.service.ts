import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TransferRequest, PlayerSearchResult } from '@floorball/types';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class TransferRequestService {
  private base = environment.apiURL + 'admin/transfer_requests';

  constructor(private http: HttpClient) {}

  getAll() {
    return this.http.get<TransferRequest[]>(`${this.base}.json`);
  }

  searchPlayer(
    firstName: string,
    lastName: string,
    birthdate: string,
    requestingClubId: number
  ) {
    return this.http.get<{ player: PlayerSearchResult | null }>(
      `${this.base}/search_player.json`,
      {
        params: {
          first_name: firstName,
          last_name: lastName,
          birthdate,
          requesting_club_id: requestingClubId.toString(),
        },
      }
    );
  }

  create(playerId: number, requestingClubId: number) {
    return this.http.post<TransferRequest>(`${this.base}.json`, {
      player_id: playerId,
      requesting_club_id: requestingClubId,
    });
  }

  approveClub(id: number) {
    return this.http.patch<TransferRequest>(
      `${this.base}/${id}/approve_club.json`,
      {}
    );
  }

  rejectClub(id: number, rejectionReason: string) {
    return this.http.patch<TransferRequest>(
      `${this.base}/${id}/reject_club.json`,
      {
        rejection_reason: rejectionReason,
      }
    );
  }

  approveLv(id: number) {
    return this.http.patch<TransferRequest>(
      `${this.base}/${id}/approve_lv.json`,
      {}
    );
  }

  rejectLv(id: number, rejectionReason: string) {
    return this.http.patch<TransferRequest>(
      `${this.base}/${id}/reject_lv.json`,
      {
        rejection_reason: rejectionReason,
      }
    );
  }
}
