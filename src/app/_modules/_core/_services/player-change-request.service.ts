import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { CorrectionType, PlayerChangeRequest } from '@floorball/types';

@Injectable({ providedIn: 'root' })
export class PlayerChangeRequestService {
  private readonly _baseUrl = `${environment.apiURL}admin/player_change_requests`;

  constructor(private _http: HttpClient) {}

  getAll(): Observable<PlayerChangeRequest[]> {
    return this._http.get<PlayerChangeRequest[]>(`${this._baseUrl}.json`);
  }

  create(
    playerId: number,
    clubId: number,
    correctionType: CorrectionType,
    newValue?: string,
    secondaryPlayerId?: number
  ): Observable<PlayerChangeRequest> {
    return this._http.post<PlayerChangeRequest>(`${this._baseUrl}.json`, {
      player_id: playerId,
      club_id: clubId,
      correction_type: correctionType,
      new_value: newValue ?? null,
      secondary_player_id: secondaryPlayerId ?? null,
    });
  }

  approve(id: number): Observable<PlayerChangeRequest> {
    return this._http.patch<PlayerChangeRequest>(
      `${this._baseUrl}/${id}/approve.json`,
      {}
    );
  }

  reject(id: number, rejectionReason: string): Observable<PlayerChangeRequest> {
    return this._http.patch<PlayerChangeRequest>(
      `${this._baseUrl}/${id}/reject.json`,
      { rejection_reason: rejectionReason }
    );
  }
}
