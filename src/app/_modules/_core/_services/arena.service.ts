import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { Arena } from '@floorball/types';

@Injectable({
  providedIn: 'root',
})
export class ArenaService {
  constructor(private http: HttpClient) {}

  public getArenas() {
    const path = environment.apiURL + 'arenas.json';
    return this.http.get<Arena[]>(path);
  }
}
