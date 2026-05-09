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

  triggerPasswordReset(id: number): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(
      `${this.base}/${id}/trigger_password_reset.json`,
      {}
    );
  }
}
