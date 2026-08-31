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

  // Wie failWith, nur lesend: Der Profilabruf unten ist ein GET, und ein POST
  // auf dieselbe Adresse gaebe es gar nicht.
  function failGetWith(body: object, status: number, url: string): void {
    http.get(url).subscribe({
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

  // Die Spielersuche der Transfermaske zeigt ihre eigenen Absagen selbst unter
  // dem Suchfeld. Ein 403 darauf heißt „dieser Verein nicht", nicht „diese
  // Maske nicht": Der generische Zweig warf aus dem ersten Schritt der
  // Direktzuweisung auf die Startseite, und die Umleitung nahm die Feldmeldung
  // gleich mit.
  //
  // Die URL ist die, die der Service wirklich sendet (`search_player.json` als
  // GET mit Abfrageparametern). Ein Spec auf einer Form, die es nicht gibt,
  // überlebt jede spätere Verschärfung des Musters.
  const searchUrl =
    `${environment.apiURL}admin/transfer_requests/search_player.json` +
    '?first_name=Max&last_name=Mustermann&birthdate=1995-03-15&requesting_club_id=42';

  function searchFailsWith(body: object, status: number): unknown {
    let received: unknown;
    http.get(searchUrl).subscribe({
      next: () => fail('expected the request to fail'),
      error: (err) => (received = err),
    });
    httpMock.expectOne(searchUrl).flush(body, { status, statusText: 'Error' });
    return received;
  }

  it('leaves the page alone when the transfer player search is forbidden', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    const err = searchFailsWith(
      { error: 'Nicht berechtigt fuer diesen Verein' },
      403
    );

    expect(errorSpy).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
    // Der Fehler muss den Abonnenten erreichen, sonst zeigt die Maske nichts an
    // und die Ausnahme hätte den Fehlschlag stumm geschaltet statt umgeleitet.
    expect((err as HttpErrorResponse).error.error).toBe(
      'Nicht berechtigt fuer diesen Verein'
    );
  });

  // Auch die fachlichen Absagen der Suche kommen ohne zweite Meldung aus.
  it('leaves the transfer player search alone on 422', () => {
    const err = searchFailsWith(
      { error: 'Spieler ist bereits in diesem Verein' },
      422
    );

    expect(errorSpy).not.toHaveBeenCalled();
    expect((err as HttpErrorResponse).error.error).toBe(
      'Spieler ist bereits in diesem Verein'
    );
  });

  // Die Ausnahme gilt genau zwei Status. Der 401 gehört nicht dazu: Die
  // Transfermaske wird angemeldet bedient, eine abgelaufene Sitzung muss
  // abmelden und auf /login führen. Ohne diesen Test macht der nächste
  // Ausnahme-Eintrag daraus wieder ein „Fehler bei der Suche." an einer Maske,
  // die nie wieder funktioniert.
  it('still logs out when the transfer player search hits an expired session', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');
    const logoutSpy = spyOn(TestBed.inject(SessionService), 'logout');

    searchFailsWith({ success: false, message: 'Not authenticated' }, 401);

    expect(logoutSpy).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(
      ['/login'],
      jasmine.objectContaining({ queryParams: jasmine.anything() })
    );
  });

  // Ein Serverfehler ist keine Absage, die die Maske formulieren könnte: Ihr
  // Rückfalltext („Fehler bei der Suche.") sähe aus wie ein Eingabefehler.
  it('still reports a server error on the transfer player search', () => {
    searchFailsWith({ message: 'Server-Fehler.' }, 500);

    expect(errorSpy).toHaveBeenCalled();
  });

  // Die Ausnahme hängt am vollständigen Pfad der Suche, nicht am Präfix des
  // Controllers: Liste, Detail und die Direktzuweisung selbst sind eigene
  // Ansichten und müssen weiter melden und umleiten.
  it('keeps the generic handling for the other transfer endpoints', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    failWith(
      { error: 'Nicht berechtigt' },
      403,
      `${environment.apiURL}admin/transfer_requests/direct_assign.json`
    );

    expect(errorSpy).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
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

  // Die Gespann-Historie ist ein Nachschlag zur offenen Ansetzung. Der 403 ist
  // dort keine Randlage: Die Ansetzungsliste ist über den Spielbetrieb des
  // Spiels gescopt, `can_access_referee?` über die Person – eine
  // LV-übergreifend angesetzte Zeile fragt beim Fokus auf Schiri 2 eine fremde
  // Person ab. Ohne die Ausnahme wirft dieser reine Fokuswechsel den Ansetzer
  // auf die Startseite.
  it('leaves the assignment alone when the partner history is forbidden', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    failWith(
      { error: 'Nicht berechtigt' },
      403,
      `${environment.apiURL}admin/referees/5/partners`
    );

    expect(errorSpy).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  // Dieselbe Ausnahme deckt die übrigen Status mit: Ein Serverfehler beim
  // Nachschlag darf nicht je Zeile einen nicht selbstschließenden Hinweis
  // stapeln, während die alphabetische Kandidatenliste unbeschadet steht.
  it('stays quiet on a server error for the partner history', () => {
    failWith({}, 500, `${environment.apiURL}admin/referees/5/partners`);

    expect(errorSpy).not.toHaveBeenCalled();
  });

  // Die Spielerdaten-Rangliste benennt den 503 des Endpunkts in ihrem eigenen
  // Kasten. Zusaetzlich zeigte der generische 5xx-Zweig einen nicht
  // selbstschliessenden Toast, und weil die Ansicht die Route nie wechselt,
  // stapelte jeder Filterklick einen weiteren deckungsgleich darueber.
  it('stays quiet when the player statistics aggregate is unavailable', () => {
    failWith(
      { error: 'Spielerdaten konnten nicht geladen werden.' },
      503,
      `${environment.apiURL}admin/player_statistics.json`
    );

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('stays quiet on a 404 for the player statistics', () => {
    failWith(
      { message: 'Verein nicht gefunden.' },
      404,
      `${environment.apiURL}admin/player_statistics.json`
    );

    expect(errorSpy).not.toHaveBeenCalled();
  });

  // Gegenprobe zur Ausnahme: Der fremde Verein MUSS weiter umleiten, sonst
  // stuende die Maske mit einem roten Kasten da, wo sie gar nicht sein darf.
  it('still redirects on a 403 for the player statistics', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    failWith(
      { message: 'Keine Berechtigung.' },
      403,
      `${environment.apiURL}admin/player_statistics.json`
    );

    expect(errorSpy).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });

  // Gegenprobe: Die Ausnahme gilt nur der Gespann-Historie. Die
  // Schiri-Detailansicht ist ein Seiteneinstieg und muss weiter umleiten.
  it('still redirects on a 403 for the referee detail', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    failWith(
      { error: 'Nicht berechtigt' },
      403,
      `${environment.apiURL}admin/referees/5`
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
  // Lizenzdokumenten bleibt die Meldung hier sichtbar, sonst waere nicht
  // erkennbar, dass die Eingabe nicht angekommen ist. Beobachtet am 15.08. bei
  // der DM der Damen an set_field (Spielsekretariat, Zeitnehmer, Livestream).
  //
  // autoClose gehoert zur Zusicherung: Ohne Routenwechsel raeumt niemand die
  // Meldungen ab, `autoClose: false` wuerde sie also unbegrenzt stapeln.
  it('keeps the user in the game report on a 403', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    failWith(
      { message: 'Keine Berechtigung.' },
      403,
      `${environment.apiURL}user/games/46345/set_field.json`
    );

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      'Berechtigungsfehler: Keine Berechtigung.',
      { autoClose: true, keepAfterRouteChange: false }
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

    expect(errorSpy).toHaveBeenCalledWith(
      'Berechtigungsfehler: Keine Berechtigung.',
      { autoClose: true, keepAfterRouteChange: false }
    );
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  // Die Entscheidung ueber einen Lizenzantrag sitzt in einer Tabellenzeile der
  // Lizenzuebersicht, deren Suche, Filter und Seitenzahl ausschliesslich im
  // Komponentenzustand stehen. Ein Rauswurf auf die Startseite kostet die ganze
  // Filterung. Der 403 ist keine Randlage: Die Liste zeigt Mannschaften, die
  // einer Liga nur ueber cup_leagues angehoeren, waehrend die schreibende
  // Pruefung nur die Hauptliga betrachtet.
  it('keeps the user in the license list on a 403', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    failWith(
      { message: 'Keine Berechtigung.' },
      403,
      `${environment.apiURL}admin/players/4711/handle_license_request.json`
    );

    expect(errorSpy).toHaveBeenCalledWith(
      'Berechtigungsfehler: Keine Berechtigung.',
      { autoClose: true, keepAfterRouteChange: false }
    );
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  // Die Erst-/Zweitlizenz-Zuordnung ist ein Knopf im geoeffneten Spielerprofil.
  // Ein 403 darauf heisst „diese Lizenz nicht", nicht „dieses Profil nicht":
  // Der generische Zweig nahm die ganze Maske mit, samt allem, was daneben halb
  // ausgefuellt war.
  it('keeps the user in the player mask on a 403 for the gf role decision', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    failWith(
      { message: 'Keine Berechtigung.' },
      403,
      `${environment.apiURL}admin/players/4711/set_gf_license_role.json`
    );

    expect(errorSpy).toHaveBeenCalledWith(
      'Berechtigungsfehler: Keine Berechtigung.',
      { autoClose: true, keepAfterRouteChange: false }
    );
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  // Der Profilabruf selbst: Die Spielersuche (/verwaltung/spieler/suche) geht
  // ueber den gesamten Bestand, das Profil dahinter ist auf den
  // Heimat-Spielbetrieb begrenzt. Jeder Treffer aus einem anderen Landesverband
  // war damit ein Link, der hier auf die Startseite fuehrte und Suchbegriff wie
  // Trefferliste mitnahm. Die Maske meldet den Fall selbst (loadDenied).
  it('leaves the player mask alone when the profile itself is forbidden', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    failGetWith(
      { message: 'Keine Berechtigung.' },
      403,
      `${environment.apiURL}admin/players/4711.json?all_licenses=true`
    );

    expect(errorSpy).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  // Die Ausnahme gilt nur dem 403. Der fruehe return duerfte den 401 nicht
  // mitnehmen, sonst meldete eine abgelaufene Sitzung beim Oeffnen eines
  // Profils niemanden mehr ab.
  it('still logs out when the profile request hits an expired session', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');
    const logoutSpy = spyOn(TestBed.inject(SessionService), 'logout');

    failGetWith(
      { message: 'Nicht eingeloggt.' },
      401,
      `${environment.apiURL}admin/players/4711.json?all_licenses=true`
    );

    expect(logoutSpy).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(
      ['/login'],
      jasmine.objectContaining({ queryParams: jasmine.anything() })
    );
  });

  // Und nur dem Profilabruf: Die Aktionen unter derselben Adresse haben eigene
  // Zweige, alles andere bleibt beim generischen Verhalten.
  it('still reports a server error on the profile request', () => {
    failGetWith(
      { message: 'kaputt' },
      500,
      `${environment.apiURL}admin/players/4711.json`
    );

    expect(errorSpy).toHaveBeenCalledWith(
      'Server-Fehler. Bitte versuche es später erneut.',
      { autoClose: false, keepAfterRouteChange: false }
    );
  });

  // Gegenprobe zu den beiden Ausnahmen oben (Profilabruf und GF-Rollen-
  // Entscheidung): Sie gelten genau diesen Adressen, nicht allem unter
  // admin/players/. `transfer` ist eine echte Route (routes.rb) und hat keinen
  // eigenen Zweig, ein 403 darauf muss weiter melden und umleiten.
  it('still redirects on a 403 for other player endpoints', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    failWith(
      { message: 'Keine Berechtigung.' },
      403,
      `${environment.apiURL}admin/players/4711/transfer.json`
    );

    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });

  // handle_license_request rendert bei einer gescheiterten Validierung
  // `{ message: player.errors }`, also den Validierungs-Hash. Ungepruefte
  // Weitergabe ergab "[object Object]" -- eine Meldung, die den Kanal belegt,
  // ohne etwas zu sagen. `message` braucht deshalb dieselbe Aufbereitung wie
  // `error`.
  it('flattens a validation hash in message instead of showing [object Object]', () => {
    failWith({ message: { valid_until: ['ist kein Datum'] } }, 422);

    expect(errorSpy.calls.mostRecent().args[0]).toBe('ist kein Datum');
  });

  // Bleibt nichts Lesbares uebrig, greift der generische Text statt eines
  // leeren oder unverstaendlichen Hinweises.
  it('falls back to the generic text when message carries nothing readable', () => {
    failWith({ message: {} }, 422);

    expect(errorSpy.calls.mostRecent().args[0]).toBe(
      'Die Eingabe konnte nicht verarbeitet werden.'
    );
  });

  // Gegenprobe: Die oeffentliche Spielansicht ist eine eigene Seite und liegt
  // nicht unter user/games/. Ein 403 darauf leitet weiter wie bisher, und die
  // Meldung bleibt dabei ueber den Routenwechsel hinweg stehen.
  it('still redirects on a 403 for the public game endpoint', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    failWith(
      { message: 'Keine Berechtigung' },
      403,
      `${environment.apiURL}games/46345.json`
    );

    expect(errorSpy).toHaveBeenCalledWith(
      'Berechtigungsfehler: Keine Berechtigung',
      { autoClose: false, keepAfterRouteChange: true }
    );
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });

  // Zweite Gegenprobe, der schaerfere Rand: Der Spieltags-Link liegt unter
  // user/game_days/ und wird beim Oeffnen des Berichts geladen. Wuerde die
  // Ausnahme spaeter auf `user/game` verkuerzt, faenge sie ihn mit ein.
  it('still redirects on a 403 for the game day overlay link', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    failWith(
      { message: 'Keine Berechtigung' },
      403,
      `${environment.apiURL}user/game_days/42/overlay_link.json`
    );

    expect(errorSpy).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });

  // Die Ausnahme gilt nur dem 403. Laeuft die Sitzung mitten im Spielbericht
  // ab, muss weiterhin abgemeldet und auf /login geleitet werden, sonst sitzt
  // jemand scheinbar angemeldet vor lauter fehlschlagenden Anfragen.
  it('still logs out on a 401 in the game report', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');
    const logoutSpy = spyOn(TestBed.inject(SessionService), 'logout');

    failWith(
      { message: 'Not authenticated' },
      401,
      `${environment.apiURL}user/games/46345/set_field.json`
    );

    expect(logoutSpy).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(
      ['/login'],
      jasmine.objectContaining({ queryParams: jasmine.anything() })
    );
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

  // Der Spielplanimport listet jede beanstandete Zeile in der Maske auf. Die
  // Antwort transportiert diese Liste als JSON-String im Feld `message`, also
  // genau dort, wo `errorDetail` den Meldungstext sucht. Ohne die Ausnahme
  // stand neben der Liste ein Toast mit rohem JSON.
  const importUrl = `${environment.apiURL}admin/leagues/import_schedule.json`;

  function importFailsWith(body: object, status: number): unknown {
    let received: unknown;
    http.post(importUrl, new FormData()).subscribe({
      next: () => fail('expected the request to fail'),
      error: (err) => (received = err),
    });
    httpMock.expectOne(importUrl).flush(body, { status, statusText: 'Error' });
    return received;
  }

  const importFehler = JSON.stringify({
    errors: ['Zeile 12: Heimteam nicht erkannt'],
    warnings: [],
  });

  it('leaves the schedule import alone on 400 so no raw JSON toast appears', () => {
    const err = importFailsWith({ message: importFehler }, 400);

    expect(errorSpy).not.toHaveBeenCalled();
    // Der Fehler muss die Maske erreichen, sonst hätte die Ausnahme den
    // Fehlschlag stumm geschaltet statt die doppelte Meldung entfernt.
    expect((err as HttpErrorResponse).error.message).toBe(importFehler);
  });

  it('leaves the schedule import alone on 422', () => {
    importFailsWith(
      {
        message: JSON.stringify({
          errors: ['Keine Importdatei'],
          warnings: [],
        }),
      },
      422
    );

    expect(errorSpy).not.toHaveBeenCalled();
  });

  // Die Ausnahme gilt genau zwei Status. Der 401 gehört nicht dazu: Der Import
  // wird angemeldet bedient, eine mitten darin abgelaufene Sitzung muss
  // abmelden. Genau diese Verwechslung war der ursprüngliche Fehler (api#568),
  // sie darf nicht über die Hintertür der Ausnahme zurückkommen.
  it('still logs out when the schedule import hits an expired session', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');
    const logoutSpy = spyOn(TestBed.inject(SessionService), 'logout');

    importFailsWith({ success: false, message: 'Not authenticated' }, 401);

    expect(logoutSpy).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(
      ['/login'],
      jasmine.objectContaining({ queryParams: jasmine.anything() })
    );
  });

  // Ein Serverfehler ist keine Zeilenliste, die die Maske aufzählen könnte.
  it('still reports a server error on the schedule import', () => {
    importFailsWith({ message: 'Server-Fehler.' }, 500);

    expect(errorSpy).toHaveBeenCalled();
  });

  // Der CSV-Nachtrag der Vereinsspielerliste zeigt den Text aus `message` selbst
  // im roten Kasten unter dem Dateifeld. Ohne die Ausnahme stand er zusätzlich
  // als Toast daneben — und der 403 warf über den generischen Zweig auf die
  // Startseite, mitsamt dem geöffneten Import-Bereich und dem Bericht darin.
  const vmImportUrl = `${environment.apiURL}admin/vm/players/import`;

  function vmImportFailsWith(body: object, status: number): unknown {
    let received: unknown;
    http.post(vmImportUrl, new FormData()).subscribe({
      next: () => fail('expected the request to fail'),
      error: (err) => (received = err),
    });
    httpMock
      .expectOne(vmImportUrl)
      .flush(body, { status, statusText: 'Error' });
    return received;
  }

  it('leaves the player CSV import alone on 422 so the file error appears once', () => {
    const err = vmImportFailsWith(
      { message: 'Der CSV fehlt die Spalte "ID".' },
      422
    );

    expect(errorSpy).not.toHaveBeenCalled();
    // Der Fehler muss die Maske erreichen, sonst hätte die Ausnahme den
    // Fehlschlag stumm geschaltet statt die doppelte Meldung entfernt.
    expect((err as HttpErrorResponse).error.message).toBe(
      'Der CSV fehlt die Spalte "ID".'
    );
  });

  it('keeps the player CSV import on its page on 403', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    vmImportFailsWith({ message: 'Keine Berechtigung.' }, 403);

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  // Die Ausnahme gilt genau zwei Status. Der 401 gehört nicht dazu: Der Import
  // wird angemeldet bedient, eine mitten darin abgelaufene Sitzung muss
  // abmelden.
  it('still logs out when the player CSV import hits an expired session', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');
    const logoutSpy = spyOn(TestBed.inject(SessionService), 'logout');

    vmImportFailsWith({ success: false, message: 'Not authenticated' }, 401);

    expect(logoutSpy).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(
      ['/login'],
      jasmine.objectContaining({ queryParams: jasmine.anything() })
    );
  });
});
