import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { StateAssociation } from '@floorball/types';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class StateAssociationService {
  constructor(private http: HttpClient) {}

  public getAll() {
    return this.http.get<StateAssociation[]>(
      environment.apiURL + 'state_associations'
    );
  }

  public adminGetAll() {
    return this.http.get<StateAssociation[]>(
      environment.apiURL + 'admin/state_associations'
    );
  }

  public adminCreate(sa: Partial<StateAssociation>) {
    return this.http.post<StateAssociation>(
      environment.apiURL + 'admin/state_associations',
      { state_association: sa }
    );
  }

  public adminUpdate(id: number, sa: Partial<StateAssociation>) {
    return this.http.put<StateAssociation>(
      environment.apiURL + 'admin/state_associations/' + id,
      { state_association: sa }
    );
  }

  public adminDelete(id: number) {
    return this.http.delete(
      environment.apiURL + 'admin/state_associations/' + id
    );
  }
}
