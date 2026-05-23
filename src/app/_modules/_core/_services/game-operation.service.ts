import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { GameOperation } from 'src/app/_models/game-operation.interface';

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

  public adminUploadBanner(gameOperationId: number, file: File) {
    const formData = new FormData();
    formData.append('banner', file);
    return this.http.post<{ banner_url: string }>(
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
