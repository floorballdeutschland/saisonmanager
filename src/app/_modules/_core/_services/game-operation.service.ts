import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import {
  GameOperation,
  GameOperationAdmin,
} from 'src/app/_models/game-operation.interface';

@Injectable({
  providedIn: 'root',
})
export class GameOperationService {
  constructor(private http: HttpClient) {}

  //
  // admin routes
  //
  public getAdminGameOperations() {
    const path = environment.apiURL + 'admin/game_operations.json';
    return this.http.get<GameOperation[]>(path);
  }

  //
  // Spielbetriebs-Verwaltung (nur bundesweite Admins). Kein eigener
  // Listen-Endpunkt: Die Liste kommt von getAdminGameOperations() oben, die
  // ohnehin alle Auswahlfelder versorgt und für einen bundesweiten Admin alle
  // Spielbetriebe liefert.
  //
  public adminGet(id: number) {
    return this.http.get<GameOperationAdmin>(
      `${environment.apiURL}admin/game_operations/${id}`
    );
  }

  public adminCreate(go: Partial<GameOperationAdmin>) {
    return this.http.post<GameOperationAdmin>(
      `${environment.apiURL}admin/game_operations`,
      { game_operation: go }
    );
  }

  public adminUpdate(id: number, go: Partial<GameOperationAdmin>) {
    return this.http.put<GameOperationAdmin>(
      `${environment.apiURL}admin/game_operations/${id}`,
      { game_operation: go }
    );
  }

  public adminDelete(id: number) {
    return this.http.delete(`${environment.apiURL}admin/game_operations/${id}`);
  }

  // Der Banner-Link muss mit hoch: Die API setzt ihn bei jedem Upload aus dem
  // Parameter (`update!(banner_link_url: params[:banner_link_url].presence)`).
  // Wird er weggelassen, loescht ein Bild-Upload den vorhandenen Link -- lautlos,
  // denn die Maske zeigt danach weiter den alten Wert.
  public adminUploadBanner(
    gameOperationId: number,
    file: File,
    bannerLinkUrl: string | null
  ) {
    const formData = new FormData();
    formData.append('banner', file);
    formData.append('banner_link_url', bannerLinkUrl ?? '');
    return this.http.post<{
      banner_url: string;
      banner_link_url: string | null;
    }>(
      `${environment.apiURL}admin/game_operations/${gameOperationId}/upload_banner.json`,
      formData
    );
  }

  public adminDeleteBanner(gameOperationId: number) {
    return this.http.delete(
      `${environment.apiURL}admin/game_operations/${gameOperationId}/banner.json`
    );
  }

  public adminUpdateBannerLink(
    gameOperationId: number,
    bannerLinkUrl: string | null
  ) {
    return this.http.patch<{ banner_link_url: string | null }>(
      `${environment.apiURL}admin/game_operations/${gameOperationId}/banner_link.json`,
      { banner_link_url: bannerLinkUrl }
    );
  }
}
