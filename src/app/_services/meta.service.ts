import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

import { environment } from '../../environments/environment';
import { InitData } from '../_models';

@Injectable()
export class MetaService {
  constructor(private http: HttpClient) {}

  public getInit() {
    const path = environment.apiURL + 'init.json';
    return this.http.get<InitData>(path);
  }
}
