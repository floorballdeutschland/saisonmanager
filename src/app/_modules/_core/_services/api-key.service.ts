import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiKey } from '@floorball/types';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ApiKeyService {
  constructor(private http: HttpClient) {}

  public getAll() {
    return this.http.get<ApiKey[]>(environment.apiURL + 'admin/api_keys');
  }

  public create(name: string) {
    return this.http.post<ApiKey>(environment.apiURL + 'admin/api_keys', {
      name,
    });
  }

  public update(id: number, active: boolean) {
    return this.http.patch<ApiKey>(
      environment.apiURL + 'admin/api_keys/' + id,
      { active }
    );
  }

  public delete(id: number) {
    return this.http.delete(environment.apiURL + 'admin/api_keys/' + id);
  }
}
