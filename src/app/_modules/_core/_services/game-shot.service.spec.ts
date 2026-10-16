import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { environment } from 'src/environments/environment';
import { SILENT_REFRESH } from '../_http/silent-refresh';
import { GameShotService } from './game-shot.service';

const API = environment.apiURL;

describe('GameShotService', () => {
  let service: GameShotService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(GameShotService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sendet Schüsse gesammelt und still', () => {
    service.saveShots(5, []).subscribe();
    const request = http.expectOne(API + 'games/5/shots.json');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ shots: [] });
    // Fehlversuche meldet die Erfassung selbst, nicht der Interceptor.
    expect(request.request.context.get(SILENT_REFRESH)).toBeTrue();
    request.flush({ shots: [] });
  });

  it('spricht die Einzelpfade über die client_uuid an', () => {
    service.updateShot(5, 'u-1', { result: 'goal' }).subscribe();
    expect(http.expectOne(API + 'games/5/shots/u-1.json').request.method).toBe(
      'PATCH'
    );

    service.deleteShot(5, 'u-1').subscribe();
    expect(http.expectOne(API + 'games/5/shots/u-1.json').request.method).toBe(
      'DELETE'
    );

    service.linkShot(5, 'u-1', 9).subscribe();
    const link = http.expectOne(API + 'games/5/shots/u-1/link.json');
    expect(link.request.body).toEqual({ event_id: 9 });
  });

  it('meldet die Vollständigkeit und holt die Serverzeit', () => {
    service.setTabletShotsComplete(5, true).subscribe();
    const put = http.expectOne(API + 'games/5/tablet_capture.json');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ complete: true });

    service.getServerTime().subscribe();
    http.expectOne(API + 'server_time.json');
  });
});
