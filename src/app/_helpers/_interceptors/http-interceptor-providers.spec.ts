import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import {
  getTranslocoTestingModule,
  NotificationService,
  SessionService,
} from '@floorball/core';
import { environment } from 'src/environments/environment';
import { HTTP_INTERCEPTOR_PROVIDERS } from './http-interceptor-providers';
import {
  PUBLIC_SESSION_BUSY_MESSAGE,
  PUBLIC_SESSION_COOKIE_MESSAGE,
} from './public-session.interceptor';

// Prueft die echte Interceptor-Liste der App im Zusammenspiel. Die
// Einzel-Specs testen jeden Interceptor fuer sich; dass ein anonymer Besucher
// am Ende Daten sieht und nicht abgemeldet wird, haengt aber an Liste und
// Reihenfolge.
describe('HTTP_INTERCEPTOR_PROVIDERS (Zusammenspiel)', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let logoutSpy: jasmine.Spy;
  let navigateSpy: jasmine.Spy;
  let errorSpy: jasmine.Spy;
  let warningSpy: jasmine.Spy;

  const scheduleUrl = `${environment.apiURL}leagues/1/schedule.json`;
  const sessionUrl = `${environment.apiURL}public_session`;
  const sessionRequired = {
    body: {
      success: false,
      message: 'API key required',
      code: 'public_session_required',
    },
    init: { status: 401, statusText: 'Unauthorized' },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      providers: [...HTTP_INTERCEPTOR_PROVIDERS],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    logoutSpy = spyOn(TestBed.inject(SessionService), 'logout');
    navigateSpy = spyOn(TestBed.inject(Router), 'navigate');
    const notifications = TestBed.inject(NotificationService);
    errorSpy = spyOn(notifications, 'error');
    warningSpy = spyOn(notifications, 'warning');
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('holt eine Sitzung, wiederholt den Abruf und meldet niemanden ab', () => {
    let result: unknown;
    http.get(scheduleUrl).subscribe((r) => (result = r));

    httpMock
      .expectOne(scheduleUrl)
      .flush(sessionRequired.body, sessionRequired.init);
    httpMock.expectOne(sessionUrl).flush({ success: true });
    httpMock.expectOne(scheduleUrl).flush([{ id: 1 }]);

    expect(result).toEqual([{ id: 1 }]);
    expect(logoutSpy).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('meldet einen Serverfehler beim Holen genau einmal', () => {
    http.get(scheduleUrl).subscribe({ error: () => undefined });

    httpMock
      .expectOne(scheduleUrl)
      .flush(sessionRequired.body, sessionRequired.init);
    httpMock
      .expectOne(sessionUrl)
      .flush({ message: 'Server-Fehler.' }, { status: 500, statusText: '' });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(logoutSpy).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  // Der Browser nimmt das Cookie nicht an: Holen klappt, die Wiederholung wird
  // wieder abgewiesen. Das muss sichtbar werden, und danach darf nicht jeder
  // weitere Abruf ein neues Ausstellen kosten.
  it('meldet abgelehnte Cookies einmal und holt danach keine Sitzungen mehr', () => {
    http.get(scheduleUrl).subscribe({ error: () => undefined });
    httpMock
      .expectOne(scheduleUrl)
      .flush(sessionRequired.body, sessionRequired.init);
    httpMock.expectOne(sessionUrl).flush({ success: true });
    httpMock
      .expectOne(scheduleUrl)
      .flush(sessionRequired.body, sessionRequired.init);

    expect(errorSpy).toHaveBeenCalledOnceWith(
      PUBLIC_SESSION_COOKIE_MESSAGE,
      jasmine.anything()
    );

    http.get(scheduleUrl).subscribe({ error: () => undefined });
    httpMock
      .expectOne(scheduleUrl)
      .flush(sessionRequired.body, sessionRequired.init);

    httpMock.expectNone(sessionUrl);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(logoutSpy).not.toHaveBeenCalled();
  });

  it('zeigt fuer ein abgewartetes 429 beim Holen keinen Fehler-Toast', () => {
    http.post(sessionUrl, {}).subscribe({ error: () => undefined });
    httpMock
      .expectOne(sessionUrl)
      .flush({}, { status: 429, statusText: 'Too Many Requests' });

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warningSpy).not.toHaveBeenCalledWith(
      PUBLIC_SESSION_BUSY_MESSAGE,
      jasmine.anything()
    );
  });
});
