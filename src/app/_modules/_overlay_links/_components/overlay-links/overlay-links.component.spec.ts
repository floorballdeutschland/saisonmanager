import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { OverlayLinksComponent } from './overlay-links.component';
import { SessionService } from '@floorball/core';
import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';

describe('OverlayLinksComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [OverlayLinksComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  // `SessionService` liest im Konstruktor `localStorage['user']`, und der
  // Speicher überlebt im Karma-Browser jeden Spec. Ohne dieses Aufräumen kippt
  // ausgerechnet die Prüfung „ohne Anmeldung kein Abruf" ins Gegenteil, sobald
  // ein anderer Spec eine Anmeldung hinterlässt -- und wegen der zufälligen
  // Spec-Reihenfolge nur manchmal.
  beforeEach(() => localStorage.removeItem('user'));
  afterEach(() => localStorage.removeItem('user'));

  function create(loggedIn: boolean) {
    if (loggedIn) {
      TestBed.inject(SessionService).currentUser = { id: 1 } as never;
    }
    const fixture = TestBed.createComponent(OverlayLinksComponent);
    fixture.componentInstance.gameDayId = 7;
    fixture.detectChanges();

    return fixture;
  }

  // Der Spielbericht rendert auch für das Spielsekretariat, das nur einen
  // Einmal-Token hat. Liefe der Overlay-Abruf dort, antwortete er mit 401 und
  // der ErrorInterceptor meldete das Sekretariat mitten im Spiel ab.
  it('bietet die Overlay-Links ohne Anmeldung nicht an', () => {
    const fixture = create(false);

    expect(fixture.componentInstance.canManageOverlay).toBeFalse();
    expect(fixture.nativeElement.classList).toContain('hidden');
    expect(fixture.nativeElement.textContent.trim()).toBe('');
    http.expectNone(
      (req) => req.url.indexOf('game_days/7/overlay_link') !== -1
    );
  });

  it('lädt für Angemeldete den bestehenden Zugang und zeigt den Abschnitt', () => {
    const fixture = create(true);

    const req = http.expectOne(
      (r) => r.url.indexOf('game_days/7/overlay_link') !== -1
    );
    expect(req.request.method).toBe('GET');
    req.flush({ active: false });
    fixture.detectChanges();

    // Das Ausblenden hängt an der Komponente selbst: In Schritt 1 sitzt sie in
    // einem Raster, in dem ein leeres Feld eine Lücke hinterließe.
    expect(fixture.nativeElement.classList).not.toContain('hidden');
    expect(fixture.nativeElement.textContent).toContain('Livestream-Overlays');
  });

  // Die Sekretariats-Übersicht kennt den Zustand schon aus ihrer eigenen
  // Antwort. Ohne diesen Weg fragte sie ihn für jeden gelisteten Spieltag
  // einzeln nach – bei einem Verein mit vollem Hallenkalender sind das leicht
  // Dutzende Abrufe für eine Seite.
  it('fragt den Zustand nicht ab, wenn der Aufrufer ihn mitliefert', () => {
    TestBed.inject(SessionService).currentUser = { id: 1 } as never;
    const fixture = TestBed.createComponent(OverlayLinksComponent);
    fixture.componentInstance.gameDayId = 7;
    fixture.componentInstance.knownLink = {
      active: true,
      expires_at: '2026-09-03T20:00:00Z',
      created_by: 'Mia Berg',
    };
    fixture.detectChanges();

    http.expectNone((r) => r.url.indexOf('game_days/7/overlay_link') !== -1);
    expect(fixture.nativeElement.textContent).toContain('Mia Berg');
  });

  // Frontend und API werden getrennt ausgerollt: Bis die API das Feld liefert,
  // kommt hier `undefined` an. Das ist keine Auskunft „kein Zugang", sonst böte
  // die Seite an, einen bestehenden Zugang zu erzeugen, und entwertete ihn.
  it('fragt den Zustand ab, wenn das Feld fehlt', () => {
    TestBed.inject(SessionService).currentUser = { id: 1 } as never;
    const fixture = TestBed.createComponent(OverlayLinksComponent);
    fixture.componentInstance.gameDayId = 7;
    fixture.componentInstance.knownLink = undefined;
    fixture.detectChanges();

    http
      .expectOne((r) => r.url.indexOf('game_days/7/overlay_link') !== -1)
      .flush({ active: false });
  });

  // Die Rechteprüfung des Servers endet beim Ausrichter. Ohne eigene Meldung
  // stünde dort der allgemeine Text, und der schickt in die falsche Richtung.
  it('nennt die fehlende Berechtigung als Grund', () => {
    const fixture = create(true);
    http
      .expectOne((r) => r.url.indexOf('game_days/7/overlay_link') !== -1)
      .flush({ active: false });

    fixture.componentInstance.generateOverlayLink();
    http
      .expectOne((r) => r.method === 'POST')
      .flush(
        { error: 'Nicht berechtigt.' },
        { status: 403, statusText: 'Forbidden' }
      );

    expect(fixture.componentInstance.overlayError).toContain(
      'darfst du keinen Overlay-Zugang erzeugen'
    );
    expect(fixture.componentInstance.overlayBusy).toBeFalse();
  });

  // Ein fehlgeschlagener Abruf ist keine Auskunft. Vorher stand danach
  // „Overlay-Links erzeugen" da, als liefe keiner -- ein Druck darauf entwertet
  // aber einen bestehenden Zugang samt der schon in OBS eingetragenen Adressen.
  it('behauptet nach einem fehlgeschlagenen Abruf nicht, es laufe kein Zugang', () => {
    const fixture = create(true);

    http
      .expectOne((r) => r.url.indexOf('game_days/7/overlay_link') !== -1)
      .flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(fixture.componentInstance.overlayStateUnknown).toBeTrue();
    expect(fixture.componentInstance.overlayLink).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'ließ sich nicht feststellen'
    );
  });

  // Das Zurückziehen ist der Notausgang, wenn ein Link im Vereinschat gelandet
  // ist. Ohne diesen Test fiele ein hängendes `overlayBusy` niemandem auf, und
  // der Knopf wäre danach dauerhaft tot.
  it('zieht einen Zugang zurück und räumt die angezeigten Adressen weg', () => {
    const fixture = create(true);
    http
      .expectOne((r) => r.url.indexOf('game_days/7/overlay_link') !== -1)
      .flush({ active: true });

    fixture.componentInstance.generateOverlayLink();
    http
      .expectOne((r) => r.method === 'POST')
      .flush({
        overlay_url: 'https://example.org/overlay',
        dock_url: 'https://example.org/dock',
        expires_at: '2026-01-13T12:00:00Z',
        created_by: 'Wer Auchimmer',
      });
    expect(fixture.componentInstance.overlayUrls).not.toBeNull();

    fixture.componentInstance.revokeOverlayLink();
    http.expectOne((r) => r.method === 'DELETE').flush({});

    expect(fixture.componentInstance.overlayUrls).toBeNull();
    expect(fixture.componentInstance.overlayLink?.active).toBeFalse();
    expect(fixture.componentInstance.overlayBusy).toBeFalse();
  });

  it('meldet einen gescheiterten Widerruf, statt den Knopf zu sperren', () => {
    const fixture = create(true);
    http
      .expectOne((r) => r.url.indexOf('game_days/7/overlay_link') !== -1)
      .flush({ active: true });

    fixture.componentInstance.revokeOverlayLink();
    http
      .expectOne((r) => r.method === 'DELETE')
      .flush(null, { status: 500, statusText: 'Server Error' });

    expect(fixture.componentInstance.overlayError).toContain(
      'nicht zurückgezogen werden'
    );
    expect(fixture.componentInstance.overlayBusy).toBeFalse();
  });

  // Der Klartext des Tokens erscheint genau einmal. Wer „Kopiert" liest, obwohl
  // nichts in der Zwischenablage liegt, fügt in OBS etwas Altes ein.
  it('meldet einen Fehlschlag der Zwischenablage, statt Kopiert zu behaupten', async () => {
    const fixture = create(true);
    http
      .expectOne((r) => r.url.indexOf('game_days/7/overlay_link') !== -1)
      .flush({ active: false });

    spyOnProperty(navigator, 'clipboard', 'get').and.returnValue(
      undefined as never
    );

    await fixture.componentInstance.copyOverlayUrl('overlay', 'https://x');

    expect(fixture.componentInstance.overlayCopied).toBe('');
    expect(fixture.componentInstance.overlayError).toContain(
      'Kopieren war nicht möglich'
    );
  });

  afterEach(() => http.verify());
});
