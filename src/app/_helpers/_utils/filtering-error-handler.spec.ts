import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  HTTP_INTERCEPTORS,
  HttpClient,
  HttpErrorResponse,
} from '@angular/common/http';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { getTranslocoTestingModule } from '@floorball/core';
import { ErrorInterceptor } from '../_interceptors/error.interceptor';
import {
  FilteringErrorHandler,
  isHandledHttpNoise,
} from './filtering-error-handler';

// Der entscheidende Test ist nicht der auf isHandledHttpNoise, sondern der auf
// den Handler: Geprüft wird, ob Sentrys Handler aufgerufen wird oder nicht.
//
// fe#239 hatte denselben Filter in beforeSend und war grün — der Test reichte
// dort eine selbst gebaute HttpErrorResponse an einen selbst gebauten Hint und
// bestätigte damit nur die eigene Annahme über das SDK. In Wirklichkeit
// übergibt Sentrys ErrorHandler `captureException` das Ergebnis seines
// Extractors, also eine Zeichenkette; der Filter war toter Code und die
// Meldungen liefen unverändert weiter (SAISONMANAGER-2A).
describe('FilteringErrorHandler', () => {
  let delegate: jasmine.SpyObj<ErrorHandler>;
  let handler: FilteringErrorHandler;

  beforeEach(() => {
    delegate = jasmine.createSpyObj<ErrorHandler>('ErrorHandler', [
      'handleError',
    ]);
    handler = new FilteringErrorHandler(delegate);
  });

  it('meldet einen abgebrochenen Request nicht weiter', () => {
    handler.handleError(new HttpErrorResponse({ status: 0 }));

    expect(delegate.handleError).not.toHaveBeenCalled();
  });

  it('meldet „nicht angemeldet" nicht weiter', () => {
    handler.handleError(new HttpErrorResponse({ status: 401 }));

    expect(delegate.handleError).not.toHaveBeenCalled();
  });

  // Ein 404 kann eine falsche Annahme im Frontend sein, ein 502 sieht nur der
  // Browser — die API meldet ihn nicht selbst, weil sie ihn nicht erzeugt hat.
  it('meldet 404 und 5xx weiter', () => {
    handler.handleError(new HttpErrorResponse({ status: 404 }));
    handler.handleError(new HttpErrorResponse({ status: 502 }));

    expect(delegate.handleError).toHaveBeenCalledTimes(2);
  });

  it('meldet gewöhnliche Fehler weiter', () => {
    const boom = new Error('boom');

    handler.handleError(boom);

    expect(delegate.handleError).toHaveBeenCalledOnceWith(boom);
  });

  // Angular wickelt Ausnahmen über zone.js ein. Ohne Auspacken greift die
  // Statusprüfung nur zufällig, je nachdem über welchen Weg der Fehler kommt.
  it('erkennt den Netzabbruch auch im zone.js-Wrapper', () => {
    handler.handleError({
      ngOriginalError: new HttpErrorResponse({ status: 0 }),
    });

    expect(delegate.handleError).not.toHaveBeenCalled();
  });

  it('reicht den Fehler unverändert weiter, nicht die ausgepackte Fassung', () => {
    const wrapper = { ngOriginalError: new HttpErrorResponse({ status: 500 }) };

    handler.handleError(wrapper);

    expect(delegate.handleError).toHaveBeenCalledOnceWith(wrapper);
  });
});

// Die eine Annahme, die der Filter noch macht: dass in der Fehlerkette
// tatsächlich eine HttpErrorResponse ankommt und nicht schon irgendwo eine
// Zeichenkette daraus geworden ist. Genau diese Annahme war beim ersten Versuch
// falsch, deshalb hier nicht behauptet, sondern durch den echten Weg geführt:
// HttpClient plus ErrorInterceptor, so wie es in der Anwendung verdrahtet ist.
describe('FilteringErrorHandler am echten HTTP-Weg', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      providers: [
        { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('bekommt eine HttpErrorResponse und verwirft sie bei Status 0', () => {
    const delegate = jasmine.createSpyObj<ErrorHandler>('ErrorHandler', [
      'handleError',
    ]);
    const handler = new FilteringErrorHandler(delegate);
    let caught: unknown;

    // Ohne error-Zweig würde die Ausnahme in Angulars ErrorHandler laufen –
    // genau der Fall, den der Filter abfängt. Für den Test wird sie hier
    // eingesammelt und dem Handler von Hand übergeben, weil der Weg über die
    // Zone im Karma-Lauf nicht deterministisch ist.
    http.get('/api/v2/init.json').subscribe({
      next: () => fail('erwartet war ein Fehlschlag'),
      error: (err) => (caught = err),
    });
    httpMock
      .expectOne('/api/v2/init.json')
      .error(new ProgressEvent('error'), {
        status: 0,
        statusText: 'Unknown Error',
      });

    expect(caught instanceof HttpErrorResponse).toBeTrue();
    expect((caught as HttpErrorResponse).status).toBe(0);

    handler.handleError(caught);

    expect(delegate.handleError).not.toHaveBeenCalled();
  });
});

describe('isHandledHttpNoise', () => {
  it('greift nur bei einer HttpErrorResponse', () => {
    expect(isHandledHttpNoise({ status: 0 })).toBeFalse();
    expect(isHandledHttpNoise(new Error('x'))).toBeFalse();
    expect(isHandledHttpNoise(undefined)).toBeFalse();
    expect(isHandledHttpNoise(null)).toBeFalse();
  });
});
