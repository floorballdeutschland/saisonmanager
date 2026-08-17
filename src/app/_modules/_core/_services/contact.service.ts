import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ContactList } from '@floorball/types';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ContactService {
  constructor(private http: HttpClient) {}

  // Immer die laufende Saison, die API entscheidet das.
  public getContacts() {
    return this.http.get<ContactList>(environment.apiURL + 'admin/contacts');
  }
}
