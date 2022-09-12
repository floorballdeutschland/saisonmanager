import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import {
  Game,
  GameEvent,
  GameEventInput,
  GameFields,
  GamePlayerEntry,
} from '@floorball/types';
import { environment } from 'src/environments/environment';
import { GameFlags } from '../../../_models/game-flags.interface';
import { GameAdditionalFields } from '../../../_models/game-additional-fields.interface';
import { RefereeEntry } from '../../../_models/referee-entry.interface';
@Injectable({
  providedIn: 'root',
})
export class RefereeService {
  constructor(private http: HttpClient) {}

  public getRefereeByLicenseNumber(licenseNumber: number) {
    const path =
      environment.apiURL + 'user/referees/' + licenseNumber + '.json';
    return this.http.get<RefereeEntry | null>(path);
  }
}
