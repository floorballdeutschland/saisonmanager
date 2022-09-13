import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RefereeEntry } from '@floorball/types';
import { environment } from 'src/environments/environment';

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
