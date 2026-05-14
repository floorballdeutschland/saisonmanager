import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UserAdminEntry } from '@floorball/types';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class UserManagementService {
  private readonly base = `${environment.apiURL}admin/users`;

  constructor(private http: HttpClient) {}

  getUsers(): Observable<UserAdminEntry[]> {
    return this.http.get<UserAdminEntry[]>(`${this.base}.json`);
  }

  getUser(id: number): Observable<UserAdminEntry> {
    return this.http.get<UserAdminEntry>(`${this.base}/${id}.json`);
  }

  updateUser(
    id: number,
    data: Partial<UserAdminEntry> & { role?: number }
  ): Observable<UserAdminEntry> {
    return this.http.patch<UserAdminEntry>(`${this.base}/${id}.json`, data);
  }

  createUser(data: {
    user: {
      user_name: string;
      first_name: string;
      last_name: string;
      email: string;
    };
    role: {
      user_group_id: number;
      game_operation_id?: number | null;
      club_id?: number | null;
    };
    teams?: number[];
  }): Observable<UserAdminEntry> {
    return this.http.post<UserAdminEntry>(`${this.base}.json`, data);
  }

  triggerPasswordReset(id: number): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(
      `${this.base}/${id}/trigger_password_reset.json`,
      {}
    );
  }
}
