import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';
import { UikitCommonModule } from '@floorball/uikit/common';
import { TransferRequest } from '@floorball/types';
import { TransferRequestIncomingComponent } from './transfer-request-incoming.component';

describe('TransferRequestIncomingComponent', () => {
  let httpMock: HttpTestingController;

  const request = (overrides: Partial<TransferRequest> = {}) =>
    ({
      id: 1,
      status: 'approved',
      request_type: 'transfer',
      direct: false,
      created_at: '2026-09-01T10:00:00Z',
      lv_approved_at: '2026-09-02T10:00:00Z',
      player: {
        id: 5,
        first_name: 'Max',
        last_name: 'Mustermann',
        birthdate: '1995-03-15',
      },
      former_club: { id: 11, name: 'Fremder Verein' },
      requesting_club: { id: 12, name: 'Eigener Verein' },
      ...overrides,
    }) as TransferRequest;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        UikitCommonModule,
        // Die Uebersetzungen stehen global unter dem Alias, nicht als
        // Scope-Schluessel: Die Komponente steht hier ohne ihr Modul und damit
        // ohne dessen TRANSLOCO_SCOPE.
        getTranslocoTestingModule({
          de: {
            transferRequestAdmin: {
              incoming: {
                title: 'Eingehende Transfers',
                back: 'Zurueck',
                hint: 'Hinweis',
                none: 'Keine eingehenden Transfers',
              },
              list: {
                colPlayer: 'Spieler',
                colFrom: 'Von',
                colTo: 'Nach',
                colType: 'Typ',
                colStatus: 'Status',
                colApprovedAt: 'Genehmigt am',
                exportCsv: 'CSV exportieren',
                loadFailed: 'Laden fehlgeschlagen',
                retry: 'Erneut versuchen',
                loading: 'Lade…',
                typeTransfer: 'Transfer',
                typeRelease: 'Freigabe',
                statusApproved: 'Genehmigt',
                statusScheduled: 'Transfer geplant',
              },
            },
          },
        }),
      ],
      declarations: [TransferRequestIncomingComponent],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // Eigener Endpunkt, nicht die Hauptliste: Die Hauptliste haengt am abgebenden
  // Verein und enthaelt die eingehenden Vorgaenge gar nicht.
  it('laedt die eingehenden Vorgaenge vom eigenen Endpunkt', () => {
    const fixture = TestBed.createComponent(TransferRequestIncomingComponent);
    fixture.detectChanges();

    const req = httpMock.expectOne((r) =>
      r.url.includes('admin/transfer_requests/incoming.json')
    );
    expect(req.request.method).toBe('GET');

    req.flush([request()]);
    fixture.detectChanges();

    expect(fixture.componentInstance.requests.length).toBe(1);
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Mustermann, Max');
    expect(text).toContain('Fremder Verein');
    expect(text).toContain('Eigener Verein');
  });

  // Der Kern der Ansicht: Sie ist Auskunft. Ueber den Vorgang entscheidet der
  // abgebende Landesverband, der Einzelabruf antwortet hier mit 403 -- eine
  // klickbare Zeile fuehrte also ins Leere.
  it('rendert keine Links und keine Aktionsknoepfe', () => {
    const fixture = TestBed.createComponent(TransferRequestIncomingComponent);
    fixture.detectChanges();
    httpMock
      .expectOne((r) => r.url.includes('incoming.json'))
      .flush([request(), request({ id: 2, request_type: 'release' })]);
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    rows.forEach((row: HTMLElement) => {
      expect(row.querySelectorAll('a').length).toBe(0);
      expect(row.querySelectorAll('button').length).toBe(0);
      // Der Zeiger ist die Zusage, dass die Zeile irgendwohin fuehrt.
      expect(row.className).not.toContain('cursor-pointer');
    });
  });

  it('zeigt den Hinweis, wenn keine eingehenden Vorgaenge vorliegen', () => {
    const fixture = TestBed.createComponent(TransferRequestIncomingComponent);
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url.includes('incoming.json')).flush([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Keine eingehenden Transfers'
    );
    expect(fixture.nativeElement.querySelectorAll('table').length).toBe(0);
  });

  // Die Liste enthaelt nur abgeschlossene Vorgaenge, der beschlossene Transfer
  // mit offenem Wirksamkeitsdatum gehoert dazu.
  it('gibt alle angezeigten Zeilen in die CSV, auch die geplanten', () => {
    const fixture = TestBed.createComponent(TransferRequestIncomingComponent);
    fixture.detectChanges();
    httpMock
      .expectOne((r) => r.url.includes('incoming.json'))
      .flush([request(), request({ id: 2, status: 'scheduled' })]);
    fixture.detectChanges();

    const clicked: string[] = [];
    spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (
      this: HTMLAnchorElement
    ) {
      clicked.push(this.download);
    });

    fixture.componentInstance.exportCsv();

    expect(clicked.length).toBe(1);
    expect(clicked[0]).toMatch(/^eingehende-transfers-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  // Vorher setzte der Fehlerzweig nur `requests = []`, und das Template kannte
  // drei Zustaende: laedt, hat Zeilen, leer. Ein 500 rendert damit den
  // Leer-Hinweis -- eine Tatsachenbehauptung, die niemand geprueft hat.
  it('sagt bei einem Serverfehler nicht, es gebe keine Vorgaenge', () => {
    const fixture = TestBed.createComponent(TransferRequestIncomingComponent);
    fixture.detectChanges();
    httpMock
      .expectOne((r) => r.url.includes('incoming.json'))
      .flush('', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).not.toContain('Keine eingehenden Transfers');
    expect(text).toContain('Laden fehlgeschlagen');
    expect(fixture.componentInstance.loadFailed).toBeTrue();
  });

  it('laedt auf Wiederholen erneut', () => {
    const fixture = TestBed.createComponent(TransferRequestIncomingComponent);
    fixture.detectChanges();
    httpMock
      .expectOne((r) => r.url.includes('incoming.json'))
      .flush('', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    fixture.componentInstance.retry();
    httpMock
      .expectOne((r) => r.url.includes('incoming.json'))
      .flush([request()]);
    fixture.detectChanges();

    expect(fixture.componentInstance.loadFailed).toBeFalse();
    expect(fixture.componentInstance.requests.length).toBe(1);
  });

  // Standard ist die laufende Saison, und der Server entscheidet das: Ohne den
  // Parameter liefert er sie, nicht alles. Ein vergessenes Flag im Browser
  // zeigt damit zu wenig statt zu viel.
  it('fragt ohne Parameter und damit nur die laufende Saison ab', () => {
    const fixture = TestBed.createComponent(TransferRequestIncomingComponent);
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.includes('incoming.json'));
    expect(req.request.params.get('all_seasons')).toBeNull();
    req.flush([]);
  });

  it('laedt mit all_seasons nach, wenn die Vergangenheit eingeblendet wird', () => {
    const fixture = TestBed.createComponent(TransferRequestIncomingComponent);
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url.includes('incoming.json')).flush([]);

    fixture.componentInstance.toggleAllSeasons();

    const zweiter = httpMock.expectOne((r) => r.url.includes('incoming.json'));
    expect(zweiter.request.params.get('all_seasons')).toBe('true');
    zweiter.flush([request()]);
    fixture.detectChanges();

    expect(fixture.componentInstance.requests.length).toBe(1);

    // Und wieder zurueck: Der Knopf schaltet in beide Richtungen.
    fixture.componentInstance.toggleAllSeasons();
    const dritter = httpMock.expectOne((r) => r.url.includes('incoming.json'));
    expect(dritter.request.params.get('all_seasons')).toBeNull();
    dritter.flush([]);
  });
});
