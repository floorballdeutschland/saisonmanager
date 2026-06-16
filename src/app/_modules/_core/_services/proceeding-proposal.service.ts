import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ProceedingProposal } from '@floorball/types';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ProceedingProposalService {
  private readonly _baseUrl = environment.apiURL + 'admin/proceeding_proposals';

  constructor(private http: HttpClient) {}

  public getAll() {
    return this.http.get<ProceedingProposal[]>(this._baseUrl);
  }

  public get(id: number) {
    return this.http.get<ProceedingProposal>(this._baseUrl + '/' + id);
  }

  public reject(id: number) {
    return this.http.post<ProceedingProposal>(
      this._baseUrl + '/' + id + '/reject',
      {}
    );
  }

  public open(id: number) {
    return this.http.post<ProceedingProposal>(
      this._baseUrl + '/' + id + '/open',
      {}
    );
  }
}
