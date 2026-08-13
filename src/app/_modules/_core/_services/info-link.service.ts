import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { InfoLink } from '@floorball/types';
import { environment } from 'src/environments/environment';

// Pflege der Links auf externe Informationsblätter (floorball.de). Nur für die
// Verwaltung – die Anzeige-Seite bekommt die Adressen über init
// (AssociationService.infoLinkUrl$), damit auch Vereinsmanager sie sehen.
@Injectable({
  providedIn: 'root',
})
export class InfoLinkService {
  constructor(private http: HttpClient) {}

  public adminGetInfoLinks() {
    return this.http.get<InfoLink[]>(environment.apiURL + 'admin/info_links');
  }

  // Leere Adresse entfernt den Link.
  public adminUpdateInfoLink(key: string, url: string) {
    return this.http.patch<InfoLink>(
      environment.apiURL + 'admin/info_links/' + key,
      { info_link: { url } }
    );
  }
}
