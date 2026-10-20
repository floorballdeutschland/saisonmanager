import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { ChangeDetectorRef, NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';

import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';
import { AssociationService } from '@floorball/core';
import { TransferRequest } from '@floorball/types';
import { TabDirective } from 'src/app/_modules/_uikit/_common/components/molecules/tabs/tab.directive';
import { TabsComponent } from 'src/app/_modules/_uikit/_common/components/molecules/tabs/tabs.component';
import { TransferRequestListComponent } from './transfer-request-list.component';

// Die Hauptliste hatte bis hierher ueberhaupt keine Spec, obwohl an ihr die
// Gebuehrenabrechnung der Landesverbaende haengt: Der CSV-Export ist die Datei,
// aus der die 10 Euro je erteilter Spielerfreigabe gestellt werden.
describe('TransferRequestListComponent', () => {
  let httpMock: HttpTestingController;
  let router: Router;

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
        getTranslocoTestingModule({
          de: {
            transferRequestAdmin: {
              list: {
                noRequests: 'Keine Transferantraege vorhanden',
                noOpenRequests: 'Keine offenen Vorgaenge',
                noCompletedRequests: 'Keine abgeschlossenen Vorgaenge',
                loadFailed: 'Laden fehlgeschlagen',
                retry: 'Erneut versuchen',
                exportCsv: 'CSV exportieren',
                summaryHintCurrent: 'Auch fruehere Saisons',
              },
            },
          },
        }),
      ],
      // Die echte Reiterleiste: Ohne sie rendert kein Reiterinhalt.
      declarations: [TransferRequestListComponent, TabsComponent, TabDirective],
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        // Sonst ginge init.json ueber den HttpTestingController und
        // `httpMock.verify()` schluege an.
        {
          provide: AssociationService,
          useValue: {
            seasons$: of([
              { id: 16, name: '2024/2025', current: false },
              { id: 17, name: '2025/2026', current: false },
              { id: 18, name: '2026/2027', current: true },
              // Kommt im Bestand teils als String.
              {
                id: '19' as unknown as number,
                name: '2027/2028',
                current: false,
              },
            ]),
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
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

  const listUrl = (r: { url: string }) =>
    r.url.endsWith('admin/transfer_requests.json');

  async function erstellt(
    url = '/'
  ): Promise<ComponentFixture<TransferRequestListComponent>> {
    await router.navigateByUrl(url);
    const fixture = TestBed.createComponent(TransferRequestListComponent);
    fixture.detectChanges();
    return fixture;
  }

  async function geladen(zeilen: TransferRequest[], url = '/') {
    const fixture = await erstellt(url);
    httpMock.expectOne(listUrl).flush(zeilen);
    await stabil(fixture);
    return fixture;
  }

  // Reiterleiste und Saisonwahl laufen ueber den Router, der asynchron
  // navigiert; danach ein zweiter Durchlauf fuer die Reiterinhalte.
  async function stabil(
    fixture: ComponentFixture<TransferRequestListComponent>
  ) {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck();
    fixture.detectChanges();
  }

  const el = (
    fixture: ComponentFixture<TransferRequestListComponent>,
    testid: string
  ): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);

  async function waehleSaison(
    fixture: ComponentFixture<TransferRequestListComponent>,
    value: string
  ) {
    // Ueber das Auswahlfeld, damit auch die (change)-Bindung geprueft ist.
    const select = el(fixture, 'transfer-season') as HTMLSelectElement;
    select.value = value;
    select.dispatchEvent(new Event('change'));
    await stabil(fixture);
  }

  // --- Abrechnungsgrundlage ---------------------------------------------------

  // Der Kern: Eine Freigabe, die spaeter widerrufen wurde, war trotzdem erteilt
  // und hat die Gebuehr ausgeloest. Vorher filterte der Export auf
  // `status === 'approved'` und verlor sie lautlos.
  it('nimmt eine widerrufene Freigabe in die Abrechnungsgrundlage', async () => {
    const fixture = await geladen([
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
  it('laesst annullierte Vorgaenge trotz Genehmigungsdatum draussen', async () => {
    const fixture = await geladen([
      request({ id: 1, status: 'approved' }),
      request({ id: 2, status: 'withdrawn' }),
      request({ id: 3, status: 'expired' }),
    ]);

    expect(fixture.componentInstance.grantedRequests.map((r) => r.id)).toEqual([
      1,
    ]);
  });

  it('laesst Vorgaenge ohne Genehmigung draussen', async () => {
    const fixture = await geladen([
      request({ id: 1, status: 'pending_lv', lv_approved_at: null }),
      request({ id: 2, status: 'rejected_by_lv', lv_approved_at: null }),
    ]);

    expect(fixture.componentInstance.grantedRequests).toEqual([]);
  });

  // Der Dateiinhalt, nicht nur der Dateiname: Ohne diese Pruefung liesse sich
  // die Auswahl zurueckdrehen, ohne dass etwas faellt.
  it('schreibt Status und Genehmigungsdatum in die CSV', async () => {
    const fixture = await geladen([
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
    const fixture = await geladen([request({ id: 1, status: 'approved' })]);
    const zeilen = await csvZeilen(fixture);

    expect(zeilen[1]).toContain('"Heimverein";"ALV";"Zweitverein";"BLV"');
  });

  // Kein Rueckfall auf den Verbandsnamen: `short_name` ist ein optionales Feld
  // der Verbandsmaske, und ein Verein ohne Landesverband kommt im Bestand vor.
  it('laesst die LV-Spalte leer, wenn kein Kuerzel mitkommt', async () => {
    const fixture = await geladen([
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

  // --- Saisonwahl -------------------------------------------------------------

  it('fragt ohne Parameter und damit nur die laufende Saison ab', async () => {
    await erstellt();

    const req = httpMock.expectOne(listUrl);
    expect(req.request.params.get('all_seasons')).toBeNull();
    req.flush([]);
  });

  it('fragt bei ?saison=alle alle Saisons ab und laesst nicht filtern', async () => {
    const fixture = await erstellt('/?saison=alle');

    const req = httpMock.expectOne(listUrl);
    expect(req.request.params.get('all_seasons')).toBe('true');
    req.flush([
      request({ id: 1, season_id: 18 }),
      request({ id: 2, season_id: 17 }),
    ]);
    await stabil(fixture);

    const c = fixture.componentInstance;
    expect(c.selectedSeasonId).toBeNull();
    expect(c.visibleRequests.length).toBe(2);
    expect(c.seasonValue).toBe('alle');
  });

  it('bietet laufende Saison, die Saisons aus init.json und alle an', async () => {
    const fixture = await geladen([]);

    const select = el(fixture, 'transfer-season') as HTMLSelectElement;
    // Erst ab der Saison, in der das Transferverfahren startete (18); 19 kommt
    // als String und wird trotzdem nach Zahl einsortiert.
    expect(Array.from(select.options).map((o) => o.value)).toEqual([
      '',
      '19',
      '18',
      'alle',
    ]);
    expect(select.options[2].textContent?.trim()).toBe('2026/2027');
    expect(select.value).toBe('');
  });

  // Die Wahl einer einzelnen Saison laedt alle Saisons und filtert im
  // Browser, genau wie frueher „Vergangene Saisons anzeigen" plus Auswahl.
  it('filtert nach einer einzelnen Saison und schreibt sie in die URL', async () => {
    const fixture = await geladen([]);
    const c = fixture.componentInstance;

    await waehleSaison(fixture, '18');
    const zweiter = httpMock.expectOne(listUrl);
    expect(zweiter.request.params.get('all_seasons')).toBe('true');
    zweiter.flush([
      request({ id: 1, season_id: 19 }),
      request({ id: 2, season_id: 18 }),
      request({
        id: 3,
        season_id: 18,
        status: 'pending_lv',
        lv_approved_at: null,
      }),
    ]);
    await stabil(fixture);

    expect(router.url).toBe('/?saison=18');
    expect(c.visibleRequests.map((r) => r.id)).toEqual([2, 3]);
    expect(c.summary[2].total).toBe(2);
    expect(c.grantedRequests.map((r) => r.id)).toEqual([2]);
    expect((el(fixture, 'transfer-season') as HTMLSelectElement).value).toBe(
      '18'
    );

    // Zwischen einzelnen Saisons und „Alle" liegt kein neuer Abruf: Die Liste
    // ist schon vollstaendig.
    await waehleSaison(fixture, 'alle');
    httpMock.expectNone(listUrl);
    expect(c.visibleRequests.length).toBe(3);
  });

  // Zurueck auf „Laufende Saison" darf keine alte Saisonauswahl stehen
  // lassen, sonst filterte sie unbemerkt mit.
  it('laedt bei „Laufende Saison" wieder ohne Flag und ohne Filter', async () => {
    const fixture = await geladen([], '/?saison=17');
    const c = fixture.componentInstance;

    await waehleSaison(fixture, '');
    const req = httpMock.expectOne(listUrl);
    expect(req.request.params.get('all_seasons')).toBeNull();
    req.flush([request({ season_id: 17 }), request({ id: 2, season_id: 18 })]);
    await stabil(fixture);

    expect(router.url).toBe('/');
    expect(c.selectedSeasonId).toBeNull();
    expect(c.visibleRequests.length).toBe(2);
  });

  it('behaelt eine Saison aus der URL, die init.json nicht kennt', async () => {
    const fixture = await geladen([], '/?saison=9');

    expect(fixture.componentInstance.seasonOptions).toEqual([
      { id: 19, name: '2027/2028' },
      { id: 18, name: '2026/2027' },
      { id: 9, name: '9' },
    ]);
  });

  it('behaelt eine aeltere Saison aus der URL mit ihrem Namen', async () => {
    const fixture = await geladen([], '/?saison=16');

    expect(fixture.componentInstance.seasonOptions).toEqual([
      { id: 19, name: '2027/2028' },
      { id: 18, name: '2026/2027' },
      { id: 16, name: '2024/2025' },
    ]);
    expect((el(fixture, 'transfer-season') as HTMLSelectElement).value).toBe(
      '16'
    );
  });

  it('laedt beim Reiterwechsel nicht neu', async () => {
    const fixture = await geladen([request()]);

    el(fixture, 'tab-auswertung')!.click();
    await stabil(fixture);

    httpMock.expectNone(listUrl);
    expect(router.url).toBe('/?reiter=auswertung');
  });

  // Zwei schnelle Wechsel setzten sonst zwei unabhaengige Abfragen ab, und die
  // zuletzt eintreffende Antwort muss nicht zur Auswahl passen.
  it('sperrt die Saisonwahl, solange geladen wird', async () => {
    const fixture = await erstellt();

    expect(
      (el(fixture, 'transfer-season') as HTMLSelectElement).disabled
    ).toBeTrue();
    httpMock.expectOne(listUrl).flush([]);
    await stabil(fixture);
    expect(
      (el(fixture, 'transfer-season') as HTMLSelectElement).disabled
    ).toBeFalse();
  });

  // Die Saisonwahl ist waehrend des Abrufs gesperrt, die URL aber nicht: Ein
  // eingefuegter Link oder eine Navigation von aussen aendert sie trotzdem.
  // Dann gewinnt der neue Abruf, der alte wird abgebrochen.
  it('bricht einen laufenden Abruf ab, wenn sich der Umfang aendert', async () => {
    const fixture = await erstellt();
    const erster = httpMock.expectOne(listUrl);

    await router.navigateByUrl('/?saison=alle');
    await stabil(fixture);

    expect(erster.cancelled).toBeTrue();
    httpMock.expectOne(listUrl).flush([]);
  });

  // --- Reiter -----------------------------------------------------------------

  it('zeigt standardmaessig die offenen Vorgaenge mit ihrer Anzahl', async () => {
    const fixture = await geladen([
      request({ id: 1, status: 'pending_lv', lv_approved_at: null }),
      request({ id: 2, status: 'scheduled' }),
      request({ id: 3, status: 'approved' }),
    ]);

    expect(el(fixture, 'tabpanel-offen')).not.toBeNull();
    expect(el(fixture, 'tabpanel-abgeschlossen')).toBeNull();
    expect(el(fixture, 'tab-offen')!.textContent).toContain('2');
    expect(
      el(fixture, 'tabpanel-offen')!.querySelectorAll('tbody tr').length
    ).toBe(2);
  });

  it('oeffnet den Reiter aus der URL', async () => {
    const fixture = await geladen(
      [request({ id: 3, status: 'approved' })],
      '/?reiter=abgeschlossen'
    );

    expect(
      el(fixture, 'tabpanel-abgeschlossen')!.querySelectorAll('tbody tr').length
    ).toBe(1);
  });

  it('sagt im Reiter Offen, dass nichts offen ist', async () => {
    const fixture = await geladen([request({ status: 'approved' })]);

    expect(el(fixture, 'tabpanel-offen')!.textContent).toContain(
      'Keine offenen Vorgaenge'
    );
  });

  it('fuehrt Uebersicht und CSV-Export im Reiter Auswertung', async () => {
    const fixture = await geladen([request()], '/?reiter=auswertung');
    const c = fixture.componentInstance;
    c.currentUserClubIds = [11];
    await stabil(fixture);

    const panel = el(fixture, 'tabpanel-auswertung')!;
    expect(
      panel.querySelector('[data-testid="transfer-summary"]')
    ).not.toBeNull();
    expect(
      panel.querySelector('[data-testid="transfer-export-csv"]')
    ).not.toBeNull();
    // Laufende Saison: der Hinweis auf fruehere offene Vorgaenge steht da.
    expect(panel.textContent).toContain('Auch fruehere Saisons');
  });

  it('laesst den Hinweis auf fruehere Saisons bei einer Saisonwahl weg', async () => {
    const fixture = await geladen([request()], '/?reiter=auswertung&saison=18');

    expect(el(fixture, 'tabpanel-auswertung')!.textContent).not.toContain(
      'Auch fruehere Saisons'
    );
  });

  // --- Fehlerzustand ----------------------------------------------------------

  it('sagt bei einem Serverfehler nicht, es gebe keine Vorgaenge', async () => {
    const fixture = await erstellt();
    httpMock
      .expectOne(listUrl)
      .flush('', { status: 500, statusText: 'Server Error' });
    await stabil(fixture);

    const text = fixture.nativeElement.textContent;
    expect(text).not.toContain('Keine offenen Vorgaenge');
    expect(text).toContain('Laden fehlgeschlagen');
    expect(el(fixture, 'tab-offen')!.textContent?.trim()).not.toMatch(/\d/);
  });

  it('zeigt den Leer-Hinweis weiterhin, wenn wirklich nichts da ist', async () => {
    const fixture = await geladen([], '/?reiter=auswertung');

    expect(fixture.nativeElement.textContent).toContain(
      'Keine Transferantraege vorhanden'
    );
    expect(fixture.componentInstance.loadFailed).toBeFalse();
  });

  // Scheitert das Nachladen, stuenden sonst die alten Zeilen unter dem
  // Fehlerkasten. Die Saisonwahl bleibt stehen, „Erneut versuchen" laedt
  // genau sie noch einmal.
  it('nimmt bei einem Fehler die Zeilen zurueck und laedt dieselbe Wahl erneut', async () => {
    const fixture = await geladen([request()]);
    const c = fixture.componentInstance;

    await waehleSaison(fixture, 'alle');
    httpMock
      .expectOne(listUrl)
      .flush('', { status: 500, statusText: 'Server Error' });
    await stabil(fixture);

    expect(c.requests).toEqual([]);
    expect(c.loadFailed).toBeTrue();
    expect(c.allSeasons).toBeTrue();

    el(fixture, 'transfer-retry')!.click();
    const req = httpMock.expectOne(listUrl);
    expect(req.request.params.get('all_seasons')).toBe('true');
    req.flush([request()]);
    await stabil(fixture);
    expect(c.loadFailed).toBeFalse();
  });

  // --- Uebersicht fuer Vereine ------------------------------------------------

  // Jeder Vorgang steht in genau einer der drei Statusspalten, und „erteilt"
  // zaehlt dieselben Zeilen wie die CSV.
  it('zaehlt je Typ offen, erteilt und nicht zustande gekommen', async () => {
    const fixture = await geladen([
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

  it('zaehlt abgehend und eingehend aus Sicht der eigenen Vereine', async () => {
    const fixture = await geladen(
      [
        request({ id: 1 }),
        request({
          id: 2,
          former_club: { id: 99, name: 'Fremd' },
          requesting_club: { id: 11, name: 'Heimverein' },
        }),
        request({ id: 3 }),
      ],
      '/?reiter=auswertung'
    );
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

  it('bietet Vereinskonten den CSV-Export an, nicht nur dem Verband', async () => {
    const fixture = await geladen([request()]);
    const c = fixture.componentInstance;

    expect(c.canExport).toBeFalse();
    c.currentUserClubIds = [11];
    expect(c.canExport).toBeTrue();
  });

  it('zeigt ohne Vereins- oder Verbandskonto keinen CSV-Export', async () => {
    const fixture = await geladen([request()], '/?reiter=auswertung');

    const panel = el(fixture, 'tabpanel-auswertung')!;
    expect(fixture.componentInstance.canExport).toBeFalse();
    expect(
      panel.querySelector('[data-testid="transfer-summary"]')
    ).not.toBeNull();
    expect(
      panel.querySelector('[data-testid="transfer-export-csv"]')
    ).toBeNull();
  });
});
