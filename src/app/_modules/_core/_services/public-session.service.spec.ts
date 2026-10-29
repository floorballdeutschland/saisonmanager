import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { environment } from 'src/environments/environment';
import {
  PUBLIC_SESSION_MAX_RETRIES,
  PublicSessionService,
  publicSessionRetryDelay,
} from './public-session.service';

describe('PublicSessionService', () => {
  let service: PublicSessionService;
  let httpMock: HttpTestingController;
  const url = `${environment.apiURL}public_session`;
  const tooMany = (retryAfter = '20') => ({
    status: 429,
    statusText: 'Too Many Requests',
    headers: { 'Retry-After': retryAfter },
  });

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(PublicSessionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('teilt ein laufendes Holen zwischen mehreren Aufrufern', () => {
    let done = 0;
    service.ensure().subscribe(() => done++);
    service.ensure().subscribe(() => done++);

    httpMock.expectOne(url).flush({ success: true });

    expect(done).toBe(2);
  });

  it('holt nach dem Abschluss beim naechsten Bedarf neu', () => {
    service.ensure().subscribe();
    httpMock.expectOne(url).flush({ success: true });

    service.ensure().subscribe();
    httpMock.expectOne(url).flush({ success: true });
  });

  // Haengte `_pending` nach einem Fehler fest, lieferte jedes weitere
  // ensure() denselben Fehler, und der Tab bliebe bis zum Neuladen ohne Daten.
  it('holt nach einem Fehlschlag beim naechsten Bedarf neu', () => {
    service.ensure().subscribe({ error: () => undefined });
    httpMock.expectOne(url).flush({}, { status: 500, statusText: '' });

    let done = false;
    service.ensure().subscribe(() => (done = true));
    httpMock.expectOne(url).flush({ success: true });

    expect(done).toBeTrue();
  });

  // Volle Halle: Die Grenze je Adresse ist erreicht. Statt eines Fehlers
  // wartet das Holen ab und klappt im naechsten Zaehlfenster.
  it('wartet ein 429 still ab und versucht es erneut', fakeAsync(() => {
    let done = false;
    let failed = false;
    service.ensure().subscribe({
      next: () => (done = true),
      error: () => (failed = true),
    });

    httpMock.expectOne(url).flush({}, tooMany('20'));
    tick(19_999);
    httpMock.expectNone(url);

    tick(10_001);
    httpMock.expectOne(url).flush({ success: true });

    expect(done).toBeTrue();
    expect(failed).toBeFalse();
  }));

  it('gibt nach der Hoechstzahl an Versuchen auf', fakeAsync(() => {
    let error: HttpErrorResponse | undefined;
    service.ensure().subscribe({ error: (e) => (error = e) });

    for (let i = 0; i <= PUBLIC_SESSION_MAX_RETRIES; i++) {
      httpMock.expectOne(url).flush({}, tooMany('1'));
      tick(11_000);
    }

    httpMock.expectNone(url);
    expect(error?.status).toBe(429);
  }));

  it('wiederholt andere Fehler nicht', fakeAsync(() => {
    let error: HttpErrorResponse | undefined;
    service.ensure().subscribe({ error: (e) => (error = e) });

    httpMock.expectOne(url).flush({}, { status: 500, statusText: '' });
    tick(120_000);

    httpMock.expectNone(url);
    expect(error?.status).toBe(500);
  }));

  describe('publicSessionRetryDelay', () => {
    const err = (retryAfter?: string) =>
      new HttpErrorResponse({
        status: 429,
        headers: retryAfter
          ? new HttpHeaders({ 'Retry-After': retryAfter })
          : new HttpHeaders(),
      });

    it('folgt Retry-After und streut obendrauf', () => {
      expect(publicSessionRetryDelay(err('20'), () => 0)).toBe(20_000);
      expect(publicSessionRetryDelay(err('20'), () => 0.5)).toBe(25_000);
    });

    it('wartet hoechstens eine Minute plus Streuung', () => {
      expect(publicSessionRetryDelay(err('3600'), () => 0)).toBe(60_000);
    });

    it('nimmt ohne brauchbaren Header eine halbe Minute', () => {
      expect(publicSessionRetryDelay(err(), () => 0)).toBe(30_000);
      expect(publicSessionRetryDelay(err('morgen'), () => 0)).toBe(30_000);
    });
  });
});
