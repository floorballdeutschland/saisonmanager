import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ContactList } from '@floorball/types';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ContactService {
  constructor(private http: HttpClient) {}

  // Ohne Saison antwortet die API mit der laufenden.
  public getContacts(seasonId?: string | number) {
    let params = new HttpParams();
    if (seasonId !== undefined && seasonId !== null && seasonId !== '') {
      params = params.set('season_id', String(seasonId));
    }

    return this.http.get<ContactList>(environment.apiURL + 'admin/contacts', {
      params,
    });
  }
}
