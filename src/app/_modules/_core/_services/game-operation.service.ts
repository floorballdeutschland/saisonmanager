import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { GameOperation } from 'src/app/_models/game-operation.interface';

@Injectable({
  providedIn: 'root',
})
export class GameOperationService {
  constructor(private http: HttpClient) {}

  //
  // admin routes
  //
  public getAdminGameOperations() {
    const path = environment.apiURL + 'admin/game_operations.json';
    return this.http.get<GameOperation[]>(path);
  }
}
