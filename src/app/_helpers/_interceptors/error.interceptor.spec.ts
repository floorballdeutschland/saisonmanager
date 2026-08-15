import { TestBed } from '@angular/core/testing';
import {
  HTTP_INTERCEPTORS,
  HttpClient,
  HttpErrorResponse,
  HttpHandler,
  HttpRequest,
} from '@angular/common/http';
import { throwError } from 'rxjs';
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
import { ErrorInterceptor } from './error.interceptor';

// Diese Specs sichern den Vertrag ab, auf den sich Komponenten stützen, die
// bewusst keinen eigenen Fehler-Toast mehr zeigen (#84, #228): Wer den lokalen
// Toast weglässt, verlässt sich darauf, dass hier einer entsteht. Ohne diese
// Tests würde ein weiterer Ausnahme-Eintrag in der Liste oben im Interceptor
// ganze Formulare stumm schalten, ohne dass ein Test rot wird.
describe('ErrorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let errorSpy: jasmine.Spy;

  // Ein Endpunkt, dessen Komponenten auf einen eigenen Toast verzichten.
  const uploadUrl = `${environment.apiURL}admin/teams/42/upload_logo.json`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      providers: [
        { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
        // Zusaetzlich unter dem eigenen Token, damit ein Test intercept()
        // direkt aufrufen kann. Das multi-Provider-Token allein ist dafuer
        // nicht injizierbar.
        ErrorInterceptor,
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    errorSpy = spyOn(TestBed.inject(NotificationService), 'error');
    // Der Sekretariats-Zweig fragt SessionService#currentUserValue, und das liest
    // aus dem localStorage. Der ueberlebt im Karma-Browser jeden Spec, also hier
    // und nach jedem Lauf ausdruecklich raeumen: Ein Rest aus einem fremden Spec
    // wuerde die Faelle unten still ins Gegenteil drehen.
    localStorage.removeItem('user');
  });

  afterEach(() => {
    localStorage.removeItem('user');
    httpMock.verify();
  });

  function failWith(
    body: object,
    status: number,
    url = uploadUrl,
    headers?: Record<string, string>
  ): void {
    http.post(url, {}, headers ? { headers } : {}).subscribe({
      next: () => fail('expected the request to fail'),
      error: () => undefined,
    });
    httpMock.expectOne(url).flush(body, { status, statusText: 'Error' });
  }

  it('shows the server message for a 422 so a component needs no own toast', () => {
    failWith(
      { message: 'Das Logo muss quadratisch sein (gleiche Breite und Höhe).' },
      422
    );

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      'Das Logo muss quadratisch sein (gleiche Breite und Höhe).',
      { autoClose: false, keepAfterRouteChange: false }
    );
  });

  it('reads the error key as well, not only message', () => {
    failWith({ error: 'Kein Bild angefügt' }, 422);

    expect(errorSpy.calls.mostRecent().args[0]).toBe('Kein Bild angefügt');
  });

  it('joins an errors array into one message', () => {
    failWith({ errors: ['Name fehlt', 'Verein fehlt'] }, 422);

    expect(errorSpy.calls.mostRecent().args[0]).toBe(
      'Name fehlt, Verein fehlt'
    );
  });

  it('falls back to a generic message when the body carries no detail', () => {
    failWith({}, 409);

    expect(errorSpy.calls.mostRecent().args[0]).toBe(
      'Die Eingabe konnte nicht verarbeitet werden.'
    );
  });

  // Der Interceptor nimmt einzelne Pfade per URL-Match aus. Ein Upload-Endpunkt
  // darf dort nicht landen, sonst verliert die Logo-Ablehnung jede Rückmeldung.
  it('does not exempt the logo upload endpoints from the notification', () => {
    failWith({ message: 'Datei zu groß.' }, 422);
    expect(errorSpy).toHaveBeenCalledTimes(1);

    failWith(
      { message: 'Datei zu groß.' },
      422,
      `${environment.apiURL}admin/clubs/42/upload_logo.json`
    );
    expect(errorSpy).toHaveBeenCalledTimes(2);
  });

  it('shows a generic message for 5xx instead of the server body', () => {
    failWith({ message: 'PG::Error' }, 500);

    expect(errorSpy).toHaveBeenCalledWith(
      'Server-Fehler. Bitte versuche es später erneut.',
      { autoClose: false, keepAfterRouteChange: false }
    );
  });

  it('reports a missing connection for status 0', () => {
    http.post(uploadUrl, {}).subscribe({
      next: () => fail('expected the request to fail'),
      error: () => undefined,
    });
    httpMock.expectOne(uploadUrl).error(new ProgressEvent('error'), {
      status: 0,
      statusText: 'Unknown Error',
    });

    expect(errorSpy.calls.mostRecent().args[0]).toBe(
      'Keine Verbindung zum Server. Bitte prüfe deine Internetverbindung.'
    );
  });

  it('prefixes a 403 and keeps it across the forced navigation', () => {
    failWith({ message: 'Keine Berechtigung' }, 403);

    expect(errorSpy).toHaveBeenCalledWith(
      'Berechtigungsfehler: Keine Berechtigung',
      { autoClose: false, keepAfterRouteChange: true }
    );
  });

  // Lizenzdokumente sind ein Nachschlag zu einer offenen Seite, keine eigene
  // Ansicht. Der generische 403-Zweig warf die Nutzerin bzw. den Nutzer mitten
  // aus der Spielerbearbeitung auf die Startseite (SAISONMANAGER-2D): Der
  // Spieler ist sichtbar, seine Unterlagen aber nicht. Geprüft wird beides —
  // kein Toast UND keine Navigation, denn der Rauswurf war das eigentliche
  // Ärgernis, nicht die Meldung.
  it('leaves the page alone when license documents are forbidden', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    failWith(
      { message: 'Keine Berechtigung.' },
      403,
      `${environment.apiURL}admin/players/19827/license_documents.json`
    );

    expect(errorSpy).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  // Die Auswahlliste der Dokumentarten am Spielerprofil hängt an derselben
  // Rechteprüfung wie die Dokumente selbst, kommt also im selben Fall mit 403
  // zurück. Ohne diese Ausnahme wäre der Rauswurf aus der Spielerbearbeitung
  // durch die Hintertür zurück.
  it('leaves the page alone when the player document types are forbidden', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    failWith(
      { message: 'Keine Berechtigung.' },
      403,
      `${environment.apiURL}admin/players/19827/document_types.json`
    );

    expect(errorSpy).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  // Gegenprobe zur Ausnahme oben: Der Katalog der Dokumentarten ist eine eigene
  // Ansicht, kein Nachschlag zu einer offenen Seite. Ein 403 darauf muss weiter
  // melden und umleiten.
  it('still redirects on a 403 for the document type catalogue', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    failWith(
      { message: 'Nicht berechtigt' },
      403,
      `${environment.apiURL}admin/document_types`
    );

    expect(errorSpy).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });

  // Gegenprobe: Die Ausnahme gilt nur den Dokumenten. Ein 403 auf einem
  // anderen Verwaltungsendpunkt muss weiterhin melden und umleiten, sonst
  // hätte die Ausnahme still den allgemeinen Schutz ausgehebelt.
  it('still redirects on a 403 outside the license documents', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    failWith({ message: 'Keine Berechtigung' }, 403);

    expect(errorSpy).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });

  // Der Spielbericht ist eine Arbeitsflaeche: Ein abgelehntes Einzelfeld darf
  // niemanden aus einem laufenden Spiel werfen. Anders als bei den
  // Lizenzdokumenten bleibt die Meldung hier stehen, sonst waere nicht
  // erkennbar, dass die Eingabe nicht angekommen ist. Beobachtet am 15.08. bei
  // der DM der Damen an set_field (Betreuer, Spielsekretariat, Livestream).
  it('keeps the user in the game report on a 403', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    failWith(
      { message: 'Keine Berechtigung.' },
      403,
      `${environment.apiURL}user/games/46345/set_field.json`
    );

    expect(errorSpy).toHaveBeenCalledWith(
      'Berechtigungsfehler: Keine Berechtigung.',
      { autoClose: false, keepAfterRouteChange: true }
    );
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  // Dieselbe Ausnahme gilt fuer die uebrigen Aktionen des Spielberichts, nicht
  // nur fuer set_field.
  it('keeps the user in the game report on a 403 while adding an event', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    failWith(
      { message: 'Keine Berechtigung.' },
      403,
      `${environment.apiURL}user/games/46345/events/add.json`
    );

    expect(errorSpy).toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  // Gegenprobe: Die oeffentliche Spielansicht ist eine eigene Seite und liegt
  // nicht unter user/games/. Ein 403 darauf leitet weiter wie bisher.
  it('still redirects on a 403 for the public game endpoint', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    failWith(
      { message: 'Keine Berechtigung' },
      403,
      `${environment.apiURL}games/46345.json`
    );

    expect(errorSpy).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });

  // Spielsekretariats-Link: kein Benutzerkonto, also nichts zum Abmelden und
  // kein Weg zurueck von /login. Der Kader-Dialog im Spielbericht lief genau
  // dort hinein (api#396). Gemeldet werden muss der Fehlschlag trotzdem, sonst
  // steht die Liste ohne Grund leer da.
  //
  // Der Serverkoerper traegt hier bewusst einen anderen Wortlaut: So belegt die
  // Erwartung, dass der eigene Hinweis gezeigt wird, und nicht die durchgereichte
  // Rails-Meldung.
  it('keeps the secretary in the game report on a 401', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');
    const logoutSpy = spyOn(TestBed.inject(SessionService), 'logout');

    failWith(
      { message: 'Not authenticated' },
      401,
      `${environment.apiURL}user/team/42/licenses.json`,
      { 'X-Secretary-Token': 'irgendwas' }
    );

    expect(logoutSpy).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      'Der Spielsekretariats-Link gilt nicht mehr. Bitte einen neuen Link anfordern.',
      { autoClose: false, keepAfterRouteChange: true }
    );
  });

  // Die Spielansicht fragt die internen Felder alle 30 Sekunden neu ab. Ohne
  // Sperre stapelt ein abgelaufener Link zwei nicht selbstschliessende Meldungen
  // pro Minute uebereinander.
  it('reports an expired secretary link only once', () => {
    const url = `${environment.apiURL}user/games/42/additional_fields.json`;

    failWith({}, 401, url, { 'X-Secretary-Token': 'irgendwas' });
    failWith({}, 401, url, { 'X-Secretary-Token': 'irgendwas' });

    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps the secretary in the game report on a 403', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    failWith(
      { success: false },
      403,
      `${environment.apiURL}user/team/42/licenses.json`,
      {
        'X-Secretary-Token': 'irgendwas',
      }
    );

    expect(errorSpy).toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  // Der Token wird nirgends aus dem sessionStorage geloescht. Wer sich in
  // derselben Registerkarte danach anmeldet, schickt ihn weiter mit, arbeitet
  // aber mit einer Sitzung: Dann muss eine abgelaufene Sitzung wieder abmelden
  // und weiterleiten, sonst bleibt die Person scheinbar angemeldet, waehrend
  // jede Anfrage fehlschlaegt.
  it('still logs out a signed-in user who carries a secretary token', () => {
    localStorage.setItem('user', JSON.stringify({ id: 1, permissions: {} }));
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');
    const logoutSpy = spyOn(TestBed.inject(SessionService), 'logout');

    failWith(
      { message: 'Not authenticated' },
      401,
      `${environment.apiURL}user/team/42/licenses.json`,
      { 'X-Secretary-Token': 'irgendwas' }
    );

    expect(logoutSpy).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: router.url },
    });
  });

  // Gegenprobe: Ohne Token bleibt es beim Abmelden samt Weiterleitung, sonst
  // haette die Ausnahme oben still den Schutz abgeschaltet.
  it('still logs out on a 401 without a secretary token', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');
    const logoutSpy = spyOn(TestBed.inject(SessionService), 'logout');

    failWith({ message: 'Not authenticated' }, 401);

    expect(logoutSpy).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: router.url },
    });
  });

  // Angular liefert eine HttpErrorResponse mit unveraendertem 2xx-Status, wenn
  // der Body einer Erfolgsantwort kein gueltiges JSON ist (Wartungs- oder
  // Portalseite mit Status 200). Vor diesem Zweig fiel so ein Fehlschlag durch
  // jede Statusabfrage und blieb voellig stumm. HttpTestingController kann
  // diesen Fall nicht erzeugen — ein 2xx gilt dort immer als Erfolg — deshalb
  // hier der direkte Weg ueber intercept() mit einem fehlschlagenden Handler.
  it('reports a success response whose body is not parsable JSON', () => {
    const interceptor = TestBed.inject(ErrorInterceptor);
    const failing = {
      handle: () =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 200,
              statusText: 'OK',
              url: uploadUrl,
              error: {
                error: new Error('parse'),
                text: '<html>Wartung</html>',
              },
            })
        ),
    } as unknown as HttpHandler;

    interceptor
      .intercept(new HttpRequest('POST', uploadUrl, {}), failing)
      .subscribe({
        next: () => fail('expected the request to fail'),
        error: () => undefined,
      });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.calls.mostRecent().args[0]).toBe(
      'Die Antwort des Servers war unlesbar. Bitte versuche es erneut.'
    );
  });

  it('leaves a normal 4xx to the branch above without doubling the toast', () => {
    failWith({ message: 'Datei zu groß.' }, 422);

    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('passes the original HttpErrorResponse on so handlers can read status', () => {
    let caught: { status?: number; error?: { message?: string } } | undefined;
    http.post(uploadUrl, {}).subscribe({
      next: () => fail('expected the request to fail'),
      error: (err) => (caught = err),
    });
    httpMock
      .expectOne(uploadUrl)
      .flush({ message: 'Datei zu groß.' }, { status: 422, statusText: 'x' });

    expect(caught?.status).toBe(422);
    expect(caught?.error?.message).toBe('Datei zu groß.');
  });
});
