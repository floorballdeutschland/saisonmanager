import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ChangeDetectorRef, NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';

import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';
import { AssociationService } from '@floorball/core';
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
      former_club: {
        id: 11,
        name: 'Heimverein',
        state_association_short_name: 'ALV',
      },
      requesting_club: {
        id: 12,
        name: 'Zweitverein',
        state_association_short_name: 'BLV',
      },
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
      providers: [
        // Sonst ginge init.json ueber den HttpTestingController und
        // `httpMock.verify()` schluege an.
        {
          provide: AssociationService,
          useValue: {
            seasons$: of([
              { id: 17, name: '2025/2026', current: false },
              { id: 18, name: '2026/2027', current: true },
            ]),
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  // downloadCsv haengt die Datei an ein <a> und klickt es an. Der Klick bleibt
  // stumm, der Inhalt wird ueber den Blob gelesen -- gleiches Muster wie in
  // player-vm-index.component.spec.ts.
  async function csvZeilen(fixture: {
    componentInstance: { exportCsv: () => void };
  }): Promise<string[]> {
    const blobs: Blob[] = [];
    spyOn(URL, 'createObjectURL').and.callFake((blob: Blob | MediaSource) => {
      blobs.push(blob as Blob);
      return 'blob:test';
    });
    spyOn(URL, 'revokeObjectURL');
    spyOn(HTMLAnchorElement.prototype, 'click');

    fixture.componentInstance.exportCsv();

    expect(blobs.length).toBe(1);
    return (await blobs[0].text())
      .split(/\r?\n/)
      .filter((z) => z.trim().length);
  }

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

    const zeilen = await csvZeilen(fixture);

    // Kopfzeile plus genau eine Datenzeile: der annullierte Vorgang fehlt.
    expect(zeilen.length).toBe(2);
    expect(zeilen[0]).toContain('Status');
    expect(zeilen[1]).toContain('Mustermann');
    expect(zeilen[1]).toContain('02.09.2026');
  });

  // Die Abrechnung haengt an der Zuordnung Verein -> Landesverband. Geprueft
  // wird die Reihenfolge mit, nicht nur das Vorkommen: Das Kuerzel steht
  // jeweils direkt hinter seinem Verein, sonst liesse sich in der Datei nicht
  // erkennen, welches Kuerzel zu welcher Seite gehoert.
  it('schreibt das LV-Kuerzel hinter den jeweiligen Verein', async () => {
    const fixture = geladen([request({ id: 1, status: 'approved' })]);
    const zeilen = await csvZeilen(fixture);

    expect(zeilen[1]).toContain('"Heimverein";"ALV";"Zweitverein";"BLV"');
  });

  // Kein Rueckfall auf den Verbandsnamen: `short_name` ist ein optionales Feld
  // der Verbandsmaske, und ein Verein ohne Landesverband kommt im Bestand vor.
  it('laesst die LV-Spalte leer, wenn kein Kuerzel mitkommt', async () => {
    const fixture = geladen([
      request({
        id: 1,
        status: 'approved',
        former_club: { id: 11, name: 'Heimverein' },
        requesting_club: {
          id: 12,
          name: 'Zweitverein',
          state_association_short_name: null,
        },
      }),
    ]);
    const zeilen = await csvZeilen(fixture);

    expect(zeilen[1]).toContain('"Heimverein";"";"Zweitverein";""');
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

  // --- Uebersicht fuer Vereine ------------------------------------------------

  // Jeder Vorgang steht in genau einer der drei Statusspalten, und „erteilt"
  // zaehlt dieselben Zeilen wie die CSV.
  it('zaehlt je Typ offen, erteilt und nicht zustande gekommen', () => {
    const fixture = geladen([
      request({ id: 1, request_type: 'release', status: 'approved' }),
      request({ id: 2, request_type: 'release', status: 'revoked' }),
      request({
        id: 3,
        request_type: 'release',
        status: 'pending_lv',
        lv_approved_at: null,
      }),
      request({ id: 4, request_type: 'transfer', status: 'scheduled' }),
      request({ id: 5, request_type: 'transfer', status: 'withdrawn' }),
      request({
        id: 6,
        request_type: 'transfer',
        status: 'rejected_by_club',
        lv_approved_at: null,
      }),
    ]);
    const c = fixture.componentInstance;
    const [transfer, release, total] = c.summary;

    expect(release).toEqual(
      jasmine.objectContaining({ open: 1, granted: 2, failed: 0, total: 3 })
    );
    expect(transfer).toEqual(
      jasmine.objectContaining({ open: 0, granted: 1, failed: 2, total: 3 })
    );
    expect(total).toEqual(
      jasmine.objectContaining({ open: 1, granted: 3, failed: 2, total: 6 })
    );
    expect(total.granted).toBe(c.grantedRequests.length);
  });

  it('zaehlt abgehend und eingehend aus Sicht der eigenen Vereine', () => {
    const fixture = geladen([
      request({ id: 1 }),
      request({
        id: 2,
        former_club: { id: 99, name: 'Fremd' },
        requesting_club: { id: 11, name: 'Heimverein' },
      }),
      request({ id: 3 }),
    ]);
    const c = fixture.componentInstance;
    c.currentUserClubIds = [11];
    // OnPush: Ohne markForCheck bliebe das Template beim alten Stand.
    fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck();
    fixture.detectChanges();

    const total = c.summary[2];
    expect(total.outgoing).toBe(2);
    expect(total.incoming).toBe(1);
    const cell = (id: string) =>
      fixture.nativeElement
        .querySelector(`[data-testid="${id}"]`)
        .textContent.trim();
    expect(cell('total-outgoing')).toBe('2');
    expect(cell('total-incoming')).toBe('1');
  });

  it('bietet Vereinskonten den CSV-Export an, nicht nur dem Verband', () => {
    const fixture = geladen([request()]);
    const c = fixture.componentInstance;

    expect(c.canExport).toBeFalse();
    c.currentUserClubIds = [11];
    expect(c.canExport).toBeTrue();
  });

  it('filtert nach einer einzelnen Saison und benennt sie aus init.json', () => {
    const fixture = geladen([]);
    const c = fixture.componentInstance;

    c.toggleAllSeasons();
    httpMock
      .expectOne((r) => r.url.endsWith('admin/transfer_requests.json'))
      .flush([
        request({ id: 1, season_id: 18 }),
        request({ id: 2, season_id: 17 }),
        request({
          id: 3,
          season_id: 17,
          status: 'pending_lv',
          lv_approved_at: null,
        }),
      ]);
    fixture.detectChanges();

    expect(c.seasonOptions).toEqual([
      { id: 18, name: '2026/2027' },
      { id: 17, name: '2025/2026' },
    ]);

    // Ueber das Auswahlfeld, damit auch die (change)-Bindung geprueft ist.
    const select: HTMLSelectElement = fixture.nativeElement.querySelector(
      '[data-testid="transfer-season"]'
    );
    select.value = '17';
    select.dispatchEvent(new Event('change'));
    expect(c.visibleRequests.map((r) => r.id)).toEqual([2, 3]);
    expect(c.summary[2].total).toBe(2);
    expect(c.grantedRequests.map((r) => r.id)).toEqual([2]);

    c.selectSeason('');
    expect(c.visibleRequests.length).toBe(3);
  });

  // Zurueck auf „nur laufende Saison" darf keine alte Saisonauswahl stehen
  // lassen, sonst filterte sie beim naechsten Aufklappen unbemerkt mit.
  it('setzt die Saisonauswahl beim Umschalten zurueck', () => {
    const fixture = geladen([]);
    const c = fixture.componentInstance;
    c.toggleAllSeasons();
    httpMock
      .expectOne((r) => r.url.endsWith('admin/transfer_requests.json'))
      .flush([request({ season_id: 17 })]);
    c.selectSeason('17');

    c.toggleAllSeasons();
    httpMock
      .expectOne((r) => r.url.endsWith('admin/transfer_requests.json'))
      .flush([]);

    expect(c.selectedSeasonId).toBeNull();
  });
});
