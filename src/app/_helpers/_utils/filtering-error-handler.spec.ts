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
import { ChunkRecoveryEnv } from './chunk-load-recovery';

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

// Der häufigste Fehler des Frontends (SAISONMANAGER-2B, rund 18.600 Ereignisse)
// endet für den Nutzer in einer weißen Seite. Geprüft wird hier die
// Verdrahtung: dass der Handler das Neuladen anstößt und nur meldet, wenn es
// nicht hilft. Die Entscheidungslogik selbst steht in chunk-load-recovery.spec.
describe('FilteringErrorHandler beim Chunk-Ladefehler', () => {
  let delegate: jasmine.SpyObj<ErrorHandler>;
  let reload: jasmine.Spy;
  let recovery: ChunkRecoveryEnv;

  beforeEach(() => {
    delegate = jasmine.createSpyObj<ErrorHandler>('ErrorHandler', [
      'handleError',
    ]);
    reload = jasmine.createSpy('reload');
    const values: Record<string, string> = {};
    recovery = {
      now: () => 1_000_000,
      storage: {
        getItem: (key: string) => values[key] ?? null,
        setItem: (key: string, value: string) => {
          values[key] = value;
        },
      },
      online: () => true,
      reload,
    };
  });

  it('lädt die Seite neu, wenn ein Programmteil nicht nachgeladen werden kann', () => {
    const handler = new FilteringErrorHandler(delegate, recovery);

    handler.handleError(new TypeError('Importing a module script failed.'));

    expect(reload).toHaveBeenCalledTimes(1);
  });

  // Behebt das Neuladen den Fehler, ist er keine Meldung wert: Fast alle
  // Fälle waren Ladeabbrüche in iOS-WebViews bei vorhandener Datei, über 1000
  // Meldungen in vier Tagen.
  it('meldet einen Ladefehler nicht, wenn neu geladen wird', () => {
    const handler = new FilteringErrorHandler(delegate, recovery);

    handler.handleError(new TypeError('Importing a module script failed.'));

    expect(reload).toHaveBeenCalledTimes(1);
    expect(delegate.handleError).not.toHaveBeenCalled();
  });

  // Der Hinweis auf ein kaputtes Deploy bleibt: Fehlt die Datei wirklich,
  // scheitert der Tab nach dem Neuladen erneut, und das wird gemeldet.
  it('meldet den zweiten Ladefehler kurz nach dem Neuladen', () => {
    const handler = new FilteringErrorHandler(delegate, recovery);
    const boom = new TypeError('Importing a module script failed.');

    handler.handleError(new TypeError('Importing a module script failed.'));
    handler.handleError(boom);

    expect(reload).toHaveBeenCalledTimes(1);
    expect(delegate.handleError).toHaveBeenCalledOnceWith(boom);
  });

  // Review zu fe#646: Ein gescheiterter Klick ins Menü lädt die Ausgangsseite
  // neu. Klickt der Nutzer erst nach Ablauf des Fensters erneut, muss das
  // zweite Neuladen trotzdem gemeldet werden, sonst bliebe ein fehlendes
  // Modul für immer still.
  it('meldet das zweite Neuladen im selben Tab auch nach Ablauf des Fensters', () => {
    let jetzt = 1_000_000;
    recovery.now = () => jetzt;
    const handler = new FilteringErrorHandler(delegate, recovery);
    const boom = new TypeError('Importing a module script failed.');

    handler.handleError(new TypeError('Importing a module script failed.'));
    jetzt += 5 * 60_000;
    handler.handleError(boom);

    expect(reload).toHaveBeenCalledTimes(2);
    expect(delegate.handleError).toHaveBeenCalledOnceWith(boom);
  });

  it('meldet das zweite Neuladen, bevor neu geladen wird', () => {
    let jetzt = 1_000_000;
    recovery.now = () => jetzt;
    const reihenfolge: string[] = [];
    delegate.handleError.and.callFake(() => reihenfolge.push('gemeldet'));
    reload.and.callFake(() => reihenfolge.push('neu geladen'));
    const handler = new FilteringErrorHandler(delegate, recovery);

    handler.handleError(new TypeError('Importing a module script failed.'));
    jetzt += 5 * 60_000;
    handler.handleError(new TypeError('Importing a module script failed.'));

    expect(reihenfolge).toEqual(['neu geladen', 'gemeldet', 'neu geladen']);
  });

  it('meldet einen Ladefehler, wenn ohne Speicher nicht neu geladen wird', () => {
    recovery.storage = null;
    const handler = new FilteringErrorHandler(delegate, recovery);

    handler.handleError(new TypeError('Importing a module script failed.'));

    expect(reload).not.toHaveBeenCalled();
    expect(delegate.handleError).toHaveBeenCalledTimes(1);
  });

  it('meldet einen Ladefehler, wenn offline nicht neu geladen wird', () => {
    recovery.online = () => false;
    const handler = new FilteringErrorHandler(delegate, recovery);

    handler.handleError(new TypeError('Importing a module script failed.'));

    expect(reload).not.toHaveBeenCalled();
    expect(delegate.handleError).toHaveBeenCalledTimes(1);
  });

  it('lädt bei einem gewöhnlichen Fehler nicht neu', () => {
    const handler = new FilteringErrorHandler(delegate, recovery);

    handler.handleError(new TypeError('x is not a function'));

    expect(reload).not.toHaveBeenCalled();
    expect(delegate.handleError).toHaveBeenCalledTimes(1);
  });

  // Ein Netzabbruch fliegt vorher aus dem Filter. Er darf kein Neuladen
  // auslösen, sonst lädt jedes Funkloch die Seite neu.
  it('lädt bei einem abgebrochenen Request nicht neu', () => {
    const handler = new FilteringErrorHandler(delegate, recovery);

    handler.handleError(new HttpErrorResponse({ status: 0 }));

    expect(reload).not.toHaveBeenCalled();
    expect(delegate.handleError).not.toHaveBeenCalled();
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
    httpMock.expectOne('/api/v2/init.json').error(new ProgressEvent('error'), {
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
