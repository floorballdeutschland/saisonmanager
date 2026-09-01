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

  function create(loggedIn: boolean) {
    if (loggedIn) {
      TestBed.inject(SessionService).currentUser = { id: 1 } as never;
    }
    const fixture = TestBed.createComponent(OverlayLinksComponent);
    fixture.componentInstance.game = { id: 1, game_day_id: 7 } as never;
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

  afterEach(() => http.verify());
});
