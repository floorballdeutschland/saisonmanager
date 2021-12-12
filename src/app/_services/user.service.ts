import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

import { environment } from '../../environments/environment';
import { InitData } from '../_models';

@Injectable()
export class UserService {
  constructor(private http: HttpClient) {}

  public login(username: string, password: string) {
    const path = environment.apiURL + 'login.json';

    const params = {
      username,
      password,
    };

    return this.http.post<any>(path, params); // TODO: fix type
  }

  public logout() {
    const path = environment.apiURL + 'logout.json';

    return this.http.post<any>(path, {}); // TODO: fix type
  }
}
