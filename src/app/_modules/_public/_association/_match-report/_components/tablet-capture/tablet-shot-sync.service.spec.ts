import { TestBed } from '@angular/core/testing';
import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import {
  getTranslocoTestingModule,
  NotificationService,
} from '@floorball/core';
import { ShotInput } from '@floorball/types';
import { ErrorInterceptor } from 'src/app/_helpers/_interceptors/error.interceptor';
import { environment } from 'src/environments/environment';

import { TabletShotSyncService } from './tablet-shot-sync.service';

const API = environment.apiURL;

function input(uuid: string): ShotInput {
  return {
    client_uuid: uuid,
    team: 'home',
    period: 1,
    game_time: '',
    tapped_at: '2026-10-16T12:00:00.000Z',
    x: 0.5,
    y: 0.5,
    result: 'saved',
  };
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
}

// Mit dem echten ErrorInterceptor: Entscheidend ist, dass ein 403 nach dem
// Berichtsabschluss weder eine Meldung stapelt noch auf die Startseite wirft,
// sondern als Zustand bei der Erfassung ankommt, die den Puffer behält.
describe('TabletShotSyncService', () => {
  let service: TabletShotSyncService;
  let http: HttpTestingController;
  let errorSpy: jasmine.Spy;
  let navigateSpy: jasmine.Spy;

  beforeEach(() => {
    localStorage.removeItem('tablet_shot_buffer_4711');
    TestBed.configureTestingModule({
      imports: [RouterTestingModule, getTranslocoTestingModule()],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
      ],
    });
    service = TestBed.inject(TabletShotSyncService);
    http = TestBed.inject(HttpTestingController);
    errorSpy = spyOn(TestBed.inject(NotificationService), 'error');
    navigateSpy = spyOn(TestBed.inject(Router), 'navigate');
  });

  afterEach(() => {
    http.verify();
    localStorage.removeItem('tablet_shot_buffer_4711');
  });

  it('meldet 403 als Zustand, behält den Puffer und bleibt still', async () => {
    service.buffer(4711).upsert(input('a'));

    const done = service.flush(4711);
    http
      .expectOne(API + 'games/4711/shots.json')
      .flush(
        { error: 'geschlossen' },
        { status: 403, statusText: 'Forbidden' }
      );
    await done;

    expect(service.state(4711)).toEqual(
      jasmine.objectContaining({ blocked: true, forbidden: true })
    );
    expect(service.pendingCount(4711)).toBe(1);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();

    // Gesperrt: nur ausdrücklich wird erneut gesendet.
    await service.flushIfAllowed(4711);
    http.expectNone(API + 'games/4711/shots.json');
  });

  it('wertet einen 404 auf das Löschen als erledigt, ohne Meldung', async () => {
    const buffer = service.buffer(4711);
    buffer.upsert(input('a'));
    buffer.remove('a', true);

    const done = service.flush(4711);
    http
      .expectOne(API + 'games/4711/shots/a.json')
      .flush({}, { status: 404, statusText: 'Not Found' });
    await done;

    expect(service.pendingCount(4711)).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('liefert Wartenden das Ende einer laufenden Übertragung', async () => {
    service.buffer(4711).upsert(input('a'));
    const first = service.flush(4711);
    const second = service.flush(4711);
    let secondDone = false;
    void second.then(() => (secondDone = true));

    await settle();
    expect(secondDone).toBeFalse();
    http.expectOne(API + 'games/4711/shots.json').flush({ shots: [] });
    await first;
    await second;
    expect(secondDone).toBeTrue();
    expect(service.pendingCount(4711)).toBe(0);
  });
});
