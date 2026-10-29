import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import {
  HTTP_INTERCEPTORS,
  HttpClient,
  HttpErrorResponse,
} from '@angular/common/http';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { environment } from 'src/environments/environment';
import { PublicSessionInterceptor } from './public-session.interceptor';

describe('PublicSessionInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  const scheduleUrl = `${environment.apiURL}leagues/1/schedule.json`;
  const sessionUrl = `${environment.apiURL}public_session`;
  const sessionRequired = {
    status: 401,
    statusText: 'Unauthorized',
  };
  const sessionRequiredBody = {
    success: false,
    message: 'API key required',
    code: 'public_session_required',
  };

  function setup(platform = 'browser') {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: PLATFORM_ID, useValue: platform },
        {
          provide: HTTP_INTERCEPTORS,
          useClass: PublicSessionInterceptor,
          multi: true,
        },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('holt bei fehlender Sitzung eine und wiederholt den Abruf', () => {
    setup();
    let result: unknown;
    http.get(scheduleUrl).subscribe((r) => (result = r));

    httpMock.expectOne(scheduleUrl).flush(sessionRequiredBody, sessionRequired);
    const sessionReq = httpMock.expectOne(sessionUrl);
    expect(sessionReq.request.method).toBe('POST');
    sessionReq.flush({ success: true });
    httpMock.expectOne(scheduleUrl).flush([{ id: 1 }]);

    expect(result).toEqual([{ id: 1 }]);
  });

  // Beim ersten Seitenaufruf scheitern mehrere Abrufe gleichzeitig. Je Abruf
  // ein eigenes Holen kratzte an der Grenze je Adresse.
  it('teilt ein Holen zwischen gleichzeitig abgewiesenen Abrufen', () => {
    setup();
    const otherUrl = `${environment.apiURL}init.json`;
    http.get(scheduleUrl).subscribe();
    http.get(otherUrl).subscribe();

    httpMock.expectOne(scheduleUrl).flush(sessionRequiredBody, sessionRequired);
    httpMock.expectOne(otherUrl).flush(sessionRequiredBody, sessionRequired);
    httpMock.expectOne(sessionUrl).flush({ success: true });

    httpMock.expectOne(scheduleUrl).flush([]);
    httpMock.expectOne(otherUrl).flush({});
  });

  it('laesst ein 401 ohne den Code unberuehrt', () => {
    setup();
    let error: HttpErrorResponse | undefined;
    http.get(scheduleUrl).subscribe({ error: (e) => (error = e) });

    httpMock
      .expectOne(scheduleUrl)
      .flush({ message: 'Not authenticated' }, sessionRequired);

    httpMock.expectNone(sessionUrl);
    expect(error?.status).toBe(401);
  });

  it('reicht das urspruengliche 401 weiter, wenn das Holen scheitert', () => {
    setup();
    let error: HttpErrorResponse | undefined;
    http.get(scheduleUrl).subscribe({ error: (e) => (error = e) });

    httpMock.expectOne(scheduleUrl).flush(sessionRequiredBody, sessionRequired);
    httpMock
      .expectOne(sessionUrl)
      .flush({ message: 'Server-Fehler.' }, { status: 500, statusText: '' });

    expect(error?.status).toBe(401);
    expect(error?.error.code).toBe('public_session_required');
  });

  it('wiederholt hoechstens einmal', () => {
    setup();
    let error: HttpErrorResponse | undefined;
    http.get(scheduleUrl).subscribe({ error: (e) => (error = e) });

    httpMock.expectOne(scheduleUrl).flush(sessionRequiredBody, sessionRequired);
    httpMock.expectOne(sessionUrl).flush({ success: true });
    httpMock.expectOne(scheduleUrl).flush(sessionRequiredBody, sessionRequired);

    httpMock.expectNone(sessionUrl);
    expect(error?.status).toBe(401);
  });

  it('greift nicht fuer fremde Adressen', () => {
    setup();
    const foreign = 'https://example.org/data.json';
    http.get(foreign).subscribe({ error: () => undefined });

    httpMock.expectOne(foreign).flush(sessionRequiredBody, sessionRequired);

    httpMock.expectNone(sessionUrl);
  });

  // Beim Vorrendern traegt der Server den Prerender-Key, ein Cookie gibt es
  // dort nicht.
  it('greift beim Server-Rendering nicht', () => {
    setup('server');
    http.get(scheduleUrl).subscribe({ error: () => undefined });

    httpMock.expectOne(scheduleUrl).flush(sessionRequiredBody, sessionRequired);

    httpMock.expectNone(sessionUrl);
  });
});
