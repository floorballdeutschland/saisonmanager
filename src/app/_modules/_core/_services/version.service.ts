import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, shareReplay } from 'rxjs';
import { environment } from 'src/environments/environment';

interface VersionResponse {
  version: string;
  changelog: {
    version: string;
    date: string;
    changes: { [section: string]: string[] };
  }[];
}

@Injectable({
  providedIn: 'root',
})
export class VersionService {
  private _data$ = this._http
    .get<VersionResponse>(environment.apiURL + 'version.json')
    .pipe(shareReplay(1));

  version$ = this._data$.pipe(map((r) => r.version));
  changelog$ = this._data$.pipe(map((r) => r.changelog));

  constructor(private _http: HttpClient) {}
}
