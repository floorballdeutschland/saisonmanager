import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { Arena } from '@floorball/types';

@Injectable({
  providedIn: 'root',
})
export class ArenaService {
  private adminBase = environment.apiURL + 'admin/arenas';

  constructor(private http: HttpClient) {}

  public getArenas() {
    return this.http.get<Arena[]>(environment.apiURL + 'arenas.json');
  }

  public getAdminArenas() {
    return this.http.get<Arena[]>(`${this.adminBase}.json`);
  }

  public createArena(data: Partial<Arena>, force = false) {
    const body = force ? { ...data, force: true } : data;
    return this.http.post<Arena>(`${this.adminBase}.json`, body);
  }

  public updateArena(id: number, data: Partial<Arena>) {
    return this.http.patch<Arena>(`${this.adminBase}/${id}.json`, data);
  }

  public deleteArena(id: number) {
    return this.http.delete(`${this.adminBase}/${id}.json`);
  }

  // Legt den Spielort `secondaryId` mit dem verbleibenden Spielort `masterId`
  // zusammen (alle Spieltage werden umgehängt, der doppelte Eintrag gelöscht).
  public mergeArena(masterId: number, secondaryId: number) {
    return this.http.post<{
      message: string;
      master: Arena;
      moved_game_days: number;
    }>(`${this.adminBase}/${masterId}/merge.json`, {
      secondary_id: secondaryId,
    });
  }
}
