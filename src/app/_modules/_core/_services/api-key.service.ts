import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiKey, CreatedApiKey } from '@floorball/types';
import { environment } from 'src/environments/environment';

export interface ApiKeyDailyCount {
  date: string;
  count: number;
}

export interface ApiKeyMonthlyCount {
  month: string;
  count: number;
}

export interface ApiKeyEndpointCount {
  /** controller#action, z. B. leagues#schedule */
  endpoint: string;
  count: number;
}

/** Nutzung eines einzelnen Keys, im Aufbau wie die allgemeine Auswertung. */
export interface ApiKeyUsageData {
  name: string;
  rate_limit: number | null;
  last_30_days: ApiKeyDailyCount[];
  last_year: ApiKeyMonthlyCount[];
  by_endpoint: ApiKeyEndpointCount[];
}

@Injectable({
  providedIn: 'root',
})
export class ApiKeyService {
  constructor(private http: HttpClient) {}

  public getAll() {
    return this.http.get<ApiKey[]>(environment.apiURL + 'admin/api_keys');
  }

  public create(name: string) {
    return this.http.post<CreatedApiKey>(
      environment.apiURL + 'admin/api_keys',
      {
        api_key: { name },
      }
    );
  }

  public update(
    id: number,
    patch: Partial<Pick<ApiKey, 'active' | 'rate_limit' | 'realtime'>>
  ) {
    return this.http.patch<ApiKey>(
      environment.apiURL + 'admin/api_keys/' + id,
      { api_key: patch }
    );
  }

  public delete(id: number) {
    return this.http.delete(environment.apiURL + 'admin/api_keys/' + id);
  }

  public getUsage(id: number) {
    return this.http.get<ApiKeyUsageData>(
      environment.apiURL + 'admin/api_keys/' + id + '/usage'
    );
  }
}
