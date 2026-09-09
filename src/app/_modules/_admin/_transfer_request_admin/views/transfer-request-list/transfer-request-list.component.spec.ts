import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';
import { TransferRequest } from '@floorball/types';
import { TransferRequestListComponent } from './transfer-request-list.component';

// Die Hauptliste hatte bis hierher ueberhaupt keine Spec, obwohl an ihr die
// Gebuehrenabrechnung der Landesverbaende haengt: Der CSV-Export ist die Datei,
// aus der die 10 Euro je erteilter Spielerfreigabe gestellt werden.
describe('TransferRequestListComponent', () => {
  let httpMock: HttpTestingController;

  const request = (overrides: Partial<TransferRequest> = {}) =>
    ({
      id: 1,
      status: 'approved',
      request_type: 'release',
      direct: false,
      season_id: 18,
      created_at: '2026-09-01T10:00:00Z',
      lv_approved_at: '2026-09-02T10:00:00Z',
      player: {
        id: 5,
        first_name: 'Max',
        last_name: 'Mustermann',
        birthdate: '1995-03-15',
      },
      former_club: { id: 11, name: 'Heimverein' },
      requesting_club: { id: 12, name: 'Zweitverein' },
      ...overrides,
    }) as TransferRequest;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule({
          de: {
            transferRequestAdmin: {
              list: {
                noRequests: 'Keine Transferantraege vorhanden',
                loadFailed: 'Laden fehlgeschlagen',
                retry: 'Erneut versuchen',
                showPastSeasons: 'Vergangene Saisons anzeigen',
                currentSeasonOnly: 'Nur laufende Saison',
              },
            },
          },
        }),
      ],
      declarations: [TransferRequestListComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function geladen(zeilen: TransferRequest[]) {
    const fixture = TestBed.createComponent(TransferRequestListComponent);
    fixture.detectChanges();
    httpMock
      .expectOne((r) => r.url.endsWith('admin/transfer_requests.json'))
      .flush(zeilen);
    fixture.detectChanges();
    return fixture;
  }

  // --- Abrechnungsgrundlage ---------------------------------------------------

  // Der Kern: Eine Freigabe, die spaeter widerrufen wurde, war trotzdem erteilt
  // und hat die Gebuehr ausgeloest. Vorher filterte der Export auf
  // `status === 'approved'` und verlor sie lautlos.
  it('nimmt eine widerrufene Freigabe in die Abrechnungsgrundlage', () => {
    const fixture = geladen([
      request({ id: 1, status: 'approved' }),
      request({ id: 2, status: 'revoked' }),
    ]);

    expect(fixture.componentInstance.grantedRequests.map((r) => r.id)).toEqual([
      1, 2,
    ]);
  });

  // Gegenrichtung, und der Grund, warum `lv_approved_at` allein nicht genuegt:
  // `cancel` und end_for_deactivated_club annullieren einen bereits
  // terminierten Vorgang und lassen den Zeitstempel stehen. Der Wechsel hat nie
  // stattgefunden, eine Gebuehr dafuer waere schlicht falsch.
  it('laesst annullierte Vorgaenge trotz Genehmigungsdatum draussen', () => {
    const fixture = geladen([
      request({ id: 1, status: 'approved' }),
      request({ id: 2, status: 'withdrawn' }),
      request({ id: 3, status: 'expired' }),
    ]);

    expect(fixture.componentInstance.grantedRequests.map((r) => r.id)).toEqual([
      1,
    ]);
  });

  it('laesst Vorgaenge ohne Genehmigung draussen', () => {
    const fixture = geladen([
      request({ id: 1, status: 'pending_lv', lv_approved_at: null }),
      request({ id: 2, status: 'rejected_by_lv', lv_approved_at: null }),
    ]);

    expect(fixture.componentInstance.grantedRequests).toEqual([]);
  });

  // Der Dateiinhalt, nicht nur der Dateiname: Ohne diese Pruefung liesse sich
  // die Auswahl zurueckdrehen, ohne dass etwas faellt.
  it('schreibt Status und Genehmigungsdatum in die CSV', async () => {
    const fixture = geladen([
      request({ id: 1, status: 'approved' }),
      request({ id: 2, status: 'withdrawn' }),
    ]);

    // downloadCsv haengt die Datei an ein <a> und klickt es an. Der Klick
    // bleibt stumm, der Inhalt wird ueber den Blob gelesen -- gleiches Muster
    // wie in player-vm-index.component.spec.ts.
    const blobs: Blob[] = [];
    spyOn(URL, 'createObjectURL').and.callFake((blob: Blob | MediaSource) => {
      blobs.push(blob as Blob);
      return 'blob:test';
    });
    spyOn(URL, 'revokeObjectURL');
    spyOn(HTMLAnchorElement.prototype, 'click');

    fixture.componentInstance.exportCsv();

    expect(blobs.length).toBe(1);
    const zeilen = (await blobs[0].text())
      .split(/\r?\n/)
      .filter((z) => z.trim().length);

    // Kopfzeile plus genau eine Datenzeile: der annullierte Vorgang fehlt.
    expect(zeilen.length).toBe(2);
    expect(zeilen[0]).toContain('Status');
    expect(zeilen[1]).toContain('Mustermann');
    expect(zeilen[1]).toContain('02.09.2026');
  });

  // --- Saison-Schalter --------------------------------------------------------

  it('fragt ohne Parameter und damit nur die laufende Saison ab', () => {
    const fixture = TestBed.createComponent(TransferRequestListComponent);
    fixture.detectChanges();

    const req = httpMock.expectOne((r) =>
      r.url.endsWith('admin/transfer_requests.json')
    );
    expect(req.request.params.get('all_seasons')).toBeNull();
    req.flush([]);
  });

  it('reicht das Flag beim Umschalten an die API weiter', () => {
    const fixture = geladen([]);

    fixture.componentInstance.toggleAllSeasons();

    const zweiter = httpMock.expectOne((r) =>
      r.url.endsWith('admin/transfer_requests.json')
    );
    expect(zweiter.request.params.get('all_seasons')).toBe('true');
    zweiter.flush([request()]);
    fixture.detectChanges();

    expect(fixture.componentInstance.requests.length).toBe(1);
  });

  // Zwei schnelle Klicks setzten sonst zwei unabhaengige Abfragen ab, und die
  // zuletzt eintreffende Antwort muss nicht zu `allSeasons` passen.
  it('nimmt keinen zweiten Klick an, solange geladen wird', () => {
    const fixture = TestBed.createComponent(TransferRequestListComponent);
    fixture.detectChanges();
    const erster = httpMock.expectOne((r) =>
      r.url.endsWith('admin/transfer_requests.json')
    );

    fixture.componentInstance.toggleAllSeasons();

    expect(fixture.componentInstance.allSeasons).toBeFalse();
    erster.flush([]);
  });

  // --- Fehlerzustand ----------------------------------------------------------

  it('sagt bei einem Serverfehler nicht, es gebe keine Vorgaenge', () => {
    const fixture = TestBed.createComponent(TransferRequestListComponent);
    fixture.detectChanges();
    httpMock
      .expectOne((r) => r.url.endsWith('admin/transfer_requests.json'))
      .flush('', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).not.toContain('Keine Transferantraege vorhanden');
    expect(text).toContain('Laden fehlgeschlagen');
  });

  it('zeigt den Leer-Hinweis weiterhin, wenn wirklich nichts da ist', () => {
    const fixture = geladen([]);

    expect(fixture.nativeElement.textContent).toContain(
      'Keine Transferantraege vorhanden'
    );
    expect(fixture.componentInstance.loadFailed).toBeFalse();
  });

  // Scheitert das Nachladen, stuenden sonst die alten Zeilen unter dem
  // Fehlerkasten -- und der Schalter behauptete, die Vergangenheit sei
  // eingeblendet.
  it('nimmt bei einem Fehler Zeilen und Schalter zurueck', () => {
    const fixture = geladen([request()]);

    fixture.componentInstance.toggleAllSeasons();
    httpMock
      .expectOne((r) => r.url.endsWith('admin/transfer_requests.json'))
      .flush('', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(fixture.componentInstance.requests).toEqual([]);
    expect(fixture.componentInstance.allSeasons).toBeFalse();
    expect(fixture.componentInstance.loadFailed).toBeTrue();
  });
});
