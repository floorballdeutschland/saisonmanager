import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';

export interface SponsorLogo {
  id: number;
  url: string;
  filename: string;
}

/**
 * Partnerlogos für die Livestream-Overlays.
 *
 * Es gibt sie auf zwei Ebenen: Der Verband pflegt die Partner einer Liga, der
 * Verein die seines Vereins. Beide Ebenen verhalten sich serverseitig
 * gleich (dieselbe Concern), deshalb reicht hier ein Dienst mit einem
 * Bereichs-Parameter statt zweier fast gleicher Dienste.
 */
export type SponsorLogoScope = 'leagues' | 'clubs';

@Injectable({
  providedIn: 'root',
})
export class SponsorLogoService {
  constructor(private http: HttpClient) {}

  public list(scope: SponsorLogoScope, ownerId: number) {
    return this.http.get<{ sponsor_logos: SponsorLogo[] }>(
      this.url(scope, ownerId)
    );
  }

  public upload(scope: SponsorLogoScope, ownerId: number, file: File) {
    const formData = new FormData();
    formData.append('sponsor_logo', file);

    return this.http.post<{ sponsor_logos: SponsorLogo[] }>(
      this.url(scope, ownerId),
      formData
    );
  }

  public remove(
    scope: SponsorLogoScope,
    ownerId: number,
    attachmentId: number
  ) {
    return this.http.delete<{ sponsor_logos: SponsorLogo[] }>(
      `${this.url(scope, ownerId)}/${attachmentId}`
    );
  }

  private url(scope: SponsorLogoScope, ownerId: number): string {
    return `${environment.apiURL}admin/${scope}/${ownerId}/sponsor_logos`;
  }
}
