import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { getTranslocoTestingModule } from '@floorball/core';
import { config as rxjsConfig } from 'rxjs';
import { AdminLicenseEntry } from '@floorball/types';

import { LicenseAdminGlobalListComponent } from './license-admin-global-list.component';

describe('LicenseAdminGlobalListComponent', () => {
  beforeEach(async () => {
    // Die Seitengröße liegt im localStorage; ohne Aufräumen würde eine
    // Wahl aus einem vorigen Test in den nächsten hineinwirken.
    localStorage.removeItem('license_admin_page_size');

    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [LicenseAdminGlobalListComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  afterEach(() => {
    // Auch nach dem letzten Test der Datei, sonst wirkt die Wahl in die
    // uebrigen Spec-Dateien desselben Karma-Laufs hinein.
    localStorage.removeItem('license_admin_page_size');
  });

  function entry(lastName: string): AdminLicenseEntry {
    return {
      player_last_name: lastName,
      player_first_name: 'Test',
      league_id: 1,
      league_name: 'Liga',
      team_name: 'Team',
      license_status_id: 1,
    } as AdminLicenseEntry;
  }

  function setup(count: number): LicenseAdminGlobalListComponent {
    const fixture = TestBed.createComponent(LicenseAdminGlobalListComponent);
    const component = fixture.componentInstance;
    component.allEntries = Array.from({ length: count }, (_, i) =>
      entry(`Spieler${i}`)
    );
    component.applyFilters();
    return component;
  }

  // Der Weg zur Detailseite hing an einem Pfeil in der letzten Spalte am
  // rechten Tabellenrand, die auf schmalen Displays hinter dem waagerechten
  // Scrollen lag. Jetzt trägt ihn der Name in der fixierten ersten Spalte.
  describe('Weg zur Liga-Seite', () => {
    it('verlinkt den Spielernamen auf die Liga und gibt den Spieler mit', () => {
      const fixture = TestBed.createComponent(LicenseAdminGlobalListComponent);
      const component = fixture.componentInstance;
      component.allEntries = [
        {
          ...entry('Muster'),
          player_id: 42,
          league_id: 7,
        } as AdminLicenseEntry,
      ];
      component.applyFilters();
      component.loading = false;
      fixture.detectChanges();

      const link: HTMLAnchorElement | null =
        fixture.nativeElement.querySelector('tbody td a');
      expect(link?.getAttribute('href')).toBe(
        '/verwaltung/lizenzwesen/verband/liga/7?spieler=42'
      );
      expect(link?.textContent).toContain('Muster, Test');
    });
  });

  describe('pagination', () => {
    it('splits the entries into pages of pageSize', () => {
      const component = setup(120);

      expect(component.pageSize).toBe(25);
      expect(component.numberOfPages).toBe(5);
      expect(component.pagedEntries.length).toBe(25);
      expect(component.pagedEntries[0].player_last_name).toBe('Spieler0');
    });

    it('serves the requested page', () => {
      const component = setup(120);

      component.changePage(5);

      expect(component.pagedEntries.length).toBe(20);
      expect(component.pagedEntries[0].player_last_name).toBe('Spieler100');
    });

    it('reports a single page when the entries fit on one', () => {
      const component = setup(10);

      expect(component.numberOfPages).toBe(1);
      expect(component.pagedEntries.length).toBe(10);
    });

    it('reports a single page when there is nothing to show', () => {
      const component = setup(0);

      expect(component.numberOfPages).toBe(1);
      expect(component.pagedEntries).toEqual([]);
    });

    it('returns to the first page when the filters change', () => {
      // Sonst bliebe die Seitenzahl hinter dem Ende der neuen Treffermenge
      // stehen und die Tabelle wirkte leer.
      const component = setup(120);
      component.changePage(3);

      component.search = 'Spieler1';
      component.applyFilters();

      expect(component.currentPage).toBe(1);
      expect(component.pagedEntries.length).toBeGreaterThan(0);
    });

    it('keeps the CSV export on the full filtered set, not just the page', () => {
      const component = setup(120);

      expect(component.filteredEntries.length).toBe(120);
      expect(component.pagedEntries.length).toBe(25);
    });
  });

  describe('Einträge pro Seite', () => {
    it('uses 25 entries as long as nothing else was chosen', () => {
      const component = setup(120);

      expect(component.pageSize).toBe(25);
      expect(component.pagedEntries.length).toBe(25);
    });

    it('applies the chosen size right away', () => {
      const component = setup(120);

      component.changePageSize(100);

      expect(component.numberOfPages).toBe(2);
      expect(component.pagedEntries.length).toBe(100);
    });

    it('remembers the choice for the next visit', () => {
      setup(120).changePageSize(100);

      const nextVisit = setup(120);

      expect(nextVisit.pageSize).toBe(100);
      expect(nextVisit.pagedEntries.length).toBe(100);
    });

    it('ignores a stored size that is not offered', () => {
      localStorage.setItem('license_admin_page_size', '7');

      expect(setup(120).pageSize).toBe(25);
    });

    it('shows every entry on one page for "Alle"', () => {
      const component = setup(120);

      component.changePageSize(0);

      expect(component.numberOfPages).toBe(1);
      expect(component.pagedEntries.length).toBe(120);
      expect(component.currentPage).toBe(1);
    });

    it('remembers "Alle" as well', () => {
      setup(120).changePageSize(0);

      expect(setup(120).pageSize).toBe(0);
    });

    // StorageService gibt für einen fehlenden Schlüssel '' zurück, Number('')
    // ist 0 und 0 heißt "Alle" – ohne gespeicherte Wahl darf deshalb nicht die
    // ganze Liste erscheinen.
    it('does not read a missing choice as "Alle"', () => {
      expect(setup(120).pageSize).toBe(25);
    });

    // Beim Umschalten soll die Stelle in der Liste erhalten bleiben, statt auf
    // Seite 1 zurückzufallen: Seite 3 zu 25 beginnt bei Eintrag 50, der zu 50
    // je Seite auf Seite 2 liegt.
    it('keeps the first visible entry when the size changes', () => {
      const component = setup(120);
      component.changePage(3);

      component.changePageSize(50);

      expect(component.currentPage).toBe(2);
      expect(component.pagedEntries[0].player_last_name).toBe('Spieler50');
    });

    // Aufgerundet läge Eintrag 50 auf Seite 2 und wäre damit aus dem Bild –
    // die Seite muss die Stelle enthalten, nicht hinter ihr beginnen.
    it('rounds down to the page holding the entry', () => {
      const component = setup(120);
      component.changePage(3);

      component.changePageSize(100);

      expect(component.currentPage).toBe(1);
      expect(
        component.pagedEntries.some((e) => e.player_last_name === 'Spieler50')
      ).toBeTrue();
    });

    // Aus "Alle" heraus gibt es keine Seitenzahl zum Mitnehmen, also beginnt
    // es wieder bei 1. Die Teilung mit 0 droht auf dem Hinweg, nicht hier.
    it('returns from "Alle" to the first page', () => {
      const component = setup(120);
      component.changePageSize(0);

      component.changePageSize(25);

      expect(component.currentPage).toBe(1);
      expect(component.pagedEntries.length).toBe(25);
    });

    // Die Vorlage bindet die Auswahl mit [ngValue] und liefert deshalb Zahlen.
    // Kommt der Wert doch einmal als Text, darf "Alle" nicht durchfallen.
    it('takes a text value as well', () => {
      const component = setup(120);

      component.changePageSize('0' as unknown as number);

      expect(component.numberOfPages).toBe(1);
      expect(component.pagedEntries.length).toBe(120);
    });
  });

  // Vorher hing das Einverständnis-Kennzeichen allein am Geburtsdatum und stand
  // deshalb bundesweit bei jeder minderjährigen Person, auch in Ligen ohne
  // diese Pflicht. Maßgeblich ist die serverseitig aufgelöste Liste.
  describe('Elternzustimmung', () => {
    function entryWithDocs(required: string[] | undefined): AdminLicenseEntry {
      return {
        ...entry('Minderjaehrig'),
        player_birthdate: '2012-05-04',
        required_documents: required,
      } as AdminLicenseEntry;
    }

    it('fordert die Zustimmung, wenn die Liga sie verlangt', () => {
      const component = TestBed.createComponent(
        LicenseAdminGlobalListComponent
      ).componentInstance;

      expect(
        component.needsParentalConsent(entryWithDocs(['parental_consent']))
      ).toBeTrue();
    });

    it('fordert sie nicht ohne Liga-Pflicht, auch bei Minderjährigen', () => {
      const component = TestBed.createComponent(
        LicenseAdminGlobalListComponent
      ).componentInstance;

      expect(component.needsParentalConsent(entryWithDocs([]))).toBeFalse();
      expect(
        component.needsParentalConsent(entryWithDocs(undefined))
      ).toBeFalse();
    });
  });

  // In der Genehmigungsübersicht war bisher nur zu sehen, DASS ein Dokument
  // vorliegt, nicht seit wann. Wer die Liste in Durchgängen abarbeitet, konnte
  // Neuzugänge nicht von längst geprüften Uploads unterscheiden.
  describe('Uploadzeitpunkt der Dokumente', () => {
    function entryWithDocuments(
      documents: AdminLicenseEntry['documents']
    ): AdminLicenseEntry {
      return { ...entry('Dokument'), documents } as AdminLicenseEntry;
    }

    it('liefert den Uploadzeitpunkt einer Dokumentart', () => {
      const component = TestBed.createComponent(
        LicenseAdminGlobalListComponent
      ).componentInstance;
      const e = entryWithDocuments({
        parental_consent: true,
        parental_consent_url: 'https://example.test/doc.pdf',
        parental_consent_uploaded_at: '2026-08-12T09:30:00.000Z',
      });

      expect(component.docUploadedAt(e, 'parental_consent')).toBe(
        '2026-08-12T09:30:00.000Z'
      );
    });

    // Ältere Serverantworten kennen das Feld nicht; die Übersicht darf davon
    // nicht abhängen und zeigt dann weiter nur das Symbol.
    it('bleibt ohne Zeitpunkt bei null', () => {
      const component = TestBed.createComponent(
        LicenseAdminGlobalListComponent
      ).componentInstance;

      expect(
        component.docUploadedAt(
          entryWithDocuments({
            parental_consent: true,
            parental_consent_url: 'https://example.test/doc.pdf',
          }),
          'parental_consent'
        )
      ).toBeNull();
      expect(
        component.docUploadedAt(entryWithDocuments(null), 'parental_consent')
      ).toBeNull();
    });

    // Die documents-Map ist über ihre Index-Signatur auch für boolesche Werte
    // offen (unter <key> steht einer). Läuft ein solcher Wert in die date-Pipe,
    // rendert sie ihn nicht als Datum, sondern wirft. Der Helfer lässt nur
    // Zeichenketten durch, damit eine unerwartete Antwort die Übersicht nicht
    // zerlegt.
    // Eine Zeichenkette ist noch kein lesbares Datum. Die date-Pipe wirft auch
    // dafuer, und zwar mitten in der Change Detection: Die ganze Uebersicht
    // rendert dann nicht mehr, nicht nur diese Zelle.
    it('reicht ein unlesbares Datum nicht durch', () => {
      const component = TestBed.createComponent(
        LicenseAdminGlobalListComponent
      ).componentInstance;

      expect(
        component.docUploadedAt(
          entryWithDocuments({
            parental_consent: true,
            parental_consent_url: 'https://example.test/doc.pdf',
            parental_consent_uploaded_at: 'irgendwann',
          }),
          'parental_consent'
        )
      ).toBeNull();
    });

    it('reicht einen booleschen Wert nicht als Zeitpunkt durch', () => {
      const component = TestBed.createComponent(
        LicenseAdminGlobalListComponent
      ).componentInstance;

      expect(
        component.docUploadedAt(
          entryWithDocuments({
            parental_consent: true,
            parental_consent_url: 'https://example.test/doc.pdf',
            parental_consent_uploaded_at: true as unknown as string,
          }),
          'parental_consent'
        )
      ).toBeNull();
    });
  });

  // Eine versehentliche Ablehnung war endgueltig: Der Antrag fiel aus der Liste
  // der offenen Antraege, und die Entscheidungsmaske der Liga-Seite rendert nur
  // Status "beantragt". Dem Verein blieb ein neuer, kostenpflichtiger Antrag.
  describe('Ablehnung widerrufen', () => {
    // Ohne eigenen error-Zweig laeuft ein Fehlschlag weiter in den globalen
    // Fehlerweg: der ErrorInterceptor zeigt ihn an, der FilteringErrorHandler
    // gibt ihn an Sentry. Genau das ist die Absicht -- im Karma-Lauf ist es
    // aber ein unbehandelter Fehler, und RxJS meldet ihn asynchron, also erst
    // nach dem Testkoerper. Deshalb fuer diesen Block stillgelegt und nicht je
    // Test: sonst reisst der Nachlaeufer die ganze Datei in ein afterAll.
    let previousOnUnhandledError: typeof rxjsConfig.onUnhandledError;

    beforeAll(() => {
      previousOnUnhandledError = rxjsConfig.onUnhandledError;
      rxjsConfig.onUnhandledError = () => undefined;
    });

    afterAll(() => {
      rxjsConfig.onUnhandledError = previousOnUnhandledError;
    });

    function rejected(
      licenseId: string,
      playerId = 42,
      lastName = 'Muster'
    ): AdminLicenseEntry {
      return {
        ...entry(lastName),
        player_id: playerId,
        license_id: licenseId,
        license_status_id: 3,
        license_status: 'Abgelehnt',
      } as AdminLicenseEntry;
    }

    function render(entries: AdminLicenseEntry[]): {
      component: LicenseAdminGlobalListComponent;
      root: HTMLElement;
      detectChanges: () => void;
    } {
      const fixture = TestBed.createComponent(LicenseAdminGlobalListComponent);
      const component = fixture.componentInstance;
      component.allEntries = entries;
      component.applyFilters();
      component.loading = false;
      fixture.detectChanges();
      return {
        component,
        root: fixture.nativeElement,
        detectChanges: () => fixture.detectChanges(),
      };
    }

    // Zeilenweise geprueft und nicht gezaehlt: Eine reine Anzahl waere auch
    // erfuellt, wenn der Knopf in der falschen Zeile stuende.
    it('bietet den Widerruf nur bei abgelehnten Antraegen an', () => {
      const { root } = render([
        rejected('lic-1'),
        { ...entry('Erteilt'), license_id: 'lic-2' } as AdminLicenseEntry,
        {
          ...entry('Zurueckgezogen'),
          license_status_id: 8,
        } as AdminLicenseEntry,
      ]);

      const rows = Array.from(root.querySelectorAll('tbody tr'));
      const withButton = rows.map(
        (row) => row.querySelector('[data-testid="revoke-rejection"]') !== null
      );
      expect(withButton).toEqual([true, false, false]);
    });

    // Nur bis "beantragt", nicht direkt auf "erteilt": Die Genehmigung bleibt
    // eine bewusste Handlung mit Gueltigkeitsdatum und ggf. Erst-/Zweitlizenz.
    it('setzt den Antrag auf "beantragt" zurueck', () => {
      const http = TestBed.inject(HttpTestingController);
      const { component, root, detectChanges } = render([rejected('lic-1')]);

      root
        .querySelector<HTMLButtonElement>('[data-testid="revoke-rejection"]')
        ?.click();
      detectChanges();
      root
        .querySelector<HTMLElement>('[data-testid="revoke-rejection-yes"]')
        ?.click();

      const req = http.expectOne((r) =>
        r.url.endsWith('admin/players/42/handle_license_request.json')
      );
      expect(req.request.body.license_id).toBe('lic-1');
      expect(req.request.body.license_status_id).toBe(2);
      expect(req.request.body.reason).toContain('Ablehnung widerrufen');
      req.flush({});

      expect(component.allEntries[0].license_status_id).toBe(2);
    });

    // Die Bestaetigung haengt an der Lizenz, nicht am Spieler: Wer in zwei Ligen
    // abgelehnt wurde, hat zwei Zeilen, und nur eine davon ist gemeint.
    it('fragt nur in der angeklickten Zeile nach', () => {
      const { component, root, detectChanges } = render([
        rejected('lic-1'),
        rejected('lic-2'),
      ]);

      component.startRevoke(component.allEntries[1]);
      detectChanges();

      expect(
        root.querySelectorAll('[data-testid="revoke-rejection"]').length
      ).toBe(1);
      expect(
        root.querySelectorAll('[data-testid="revoke-rejection-yes"]').length
      ).toBe(1);
    });

    // Die widerrufene Zeile passt nicht mehr zum Statusfilter "abgelehnt" und
    // muss aus der Trefferliste – aber ohne die Liste auf Seite 1 zu reissen.
    it('filtert neu und bleibt auf der Seite', () => {
      const http = TestBed.inject(HttpTestingController);
      const fixture = TestBed.createComponent(LicenseAdminGlobalListComponent);
      const component = fixture.componentInstance;
      component.allEntries = Array.from({ length: 120 }, (_, i) =>
        rejected(`lic-${i}`, i + 1, `Spieler${i}`)
      );
      component.filterStatusId = 3;
      component.applyFilters();
      component.changePage(3);

      component.revokeRejection(component.allEntries[60]);
      http
        .expectOne((r) =>
          r.url.endsWith('admin/players/61/handle_license_request.json')
        )
        .flush({});

      expect(component.filteredEntries.length).toBe(119);
      expect(component.currentPage).toBe(3);
    });

    // Nach dem Erfolg muss der Riegel fallen. Bleibt er stehen, schluckt die
    // Maske jeden weiteren Widerruf still - der Riegel gilt je Zeile, aber ohne
    // Freigabe waere diese Zeile dauerhaft tot.
    it('gibt die Zeile nach dem Widerruf wieder frei', () => {
      const http = TestBed.inject(HttpTestingController);
      const { component } = render([rejected('lic-1')]);

      component.revokeRejection(component.allEntries[0]);
      http
        .expectOne((r) =>
          r.url.endsWith('admin/players/42/handle_license_request.json')
        )
        .flush({});

      expect(component.revokingLicenseId).toBeNull();
      expect(component.allEntries[0].license_status_id).toBe(2);
    });

    // Der Riegel war zuerst global. Eine zweite Zeile liess sich dann waehrend
    // eines laufenden Widerrufs nicht widerrufen, obwohl ihr Knopf gar nicht
    // deaktiviert war - der Klick fiel stumm ins Leere.
    it('sperrt nur die laufende Zeile, nicht die Nachbarzeile', () => {
      const http = TestBed.inject(HttpTestingController);
      const { component } = render([
        rejected('lic-1', 42),
        rejected('lic-2', 43),
      ]);

      component.revokeRejection(component.allEntries[0]);
      component.revokeRejection(component.allEntries[1]);

      // Beide Anfragen sind unterwegs: Der globale Riegel haette die zweite
      // verworfen, und expectOne waere daran gescheitert.
      const first = http.match((r) =>
        r.url.endsWith('admin/players/42/handle_license_request.json')
      );
      const second = http.match((r) =>
        r.url.endsWith('admin/players/43/handle_license_request.json')
      );
      expect(first.length).toBe(1);
      expect(second.length).toBe(1);

      second[0].flush({});
      first[0].flush({});
      expect(component.allEntries[0].license_status_id).toBe(2);
      expect(component.allEntries[1].license_status_id).toBe(2);
    });

    // Waehrend eine Zeile laeuft, oeffnet die Bedienung die Rueckfrage einer
    // anderen. Trifft die Antwort der ersten ein, darf sie die fremde Rueckfrage
    // nicht zuklappen - sonst verschwindet sie unter dem Mauszeiger, begleitet
    // von der Erfolgsmeldung fuer einen anderen Spieler.
    it('laesst die Rueckfrage einer anderen Zeile stehen', () => {
      const http = TestBed.inject(HttpTestingController);
      const { component } = render([
        rejected('lic-1', 42),
        rejected('lic-2', 43),
      ]);

      component.revokeRejection(component.allEntries[0]);
      component.startRevoke(component.allEntries[1]);
      http
        .expectOne((r) =>
          r.url.endsWith('admin/players/42/handle_license_request.json')
        )
        .flush({});

      expect(component.confirmRevokeLicenseId).toBe('lic-2');
    });

    // Die Liste wird einmal geladen. Wurde der Antrag zwischenzeitlich anderswo
    // genehmigt, zeigt die Zeile noch "abgelehnt" - ein Widerruf setzte dann
    // eine erteilte Lizenz auf "beantragt" zurueck. Die API kann das nicht
    // abfangen, sie prueft nur, dass der Status abweicht.
    it('widerruft nichts, wenn die Zeile nicht mehr abgelehnt ist', () => {
      const http = TestBed.inject(HttpTestingController);
      const { component } = render([rejected('lic-1')]);
      component.allEntries[0].license_status_id = 1;

      component.revokeRejection(component.allEntries[0]);

      http.expectNone((r) =>
        r.url.endsWith('admin/players/42/handle_license_request.json')
      );
      expect(component.revokingLicenseId).toBeNull();
      expect(component.allEntries[0].license_status_id).toBe(1);
    });

    // Der Fehlerzweig war zuerst eine eigene Meldung. Die stapelte sich ueber
    // die des ErrorInterceptors, der 4xx bereits anzeigt. Ohne eigenen Zweig
    // bleibt der Zustand trotzdem brauchbar: Riegel frei, Rueckfrage offen,
    // Zeile unveraendert, zweiter Versuch geht raus.
    // Dass hier ueberhaupt etwas abgefangen werden muss, ist der Beweis fuer die
    // Absicht: Ohne eigenen error-Zweig laeuft der Fehlschlag weiter in den
    // globalen Fehlerweg (ErrorInterceptor fuer die Meldung, FilteringErrorHandler
    // fuer Sentry). Im Karma-Lauf ist das ein unbehandelter Fehler, der die
    // ganze Datei abbricht -- deshalb nur fuer diesen Spec stillgelegt. Wird der
    // eigene Zweig je wieder eingebaut, faellt die Zusicherung darunter auf.
    it('bleibt nach einem Fehlschlag versuchsbereit', () => {
      const http = TestBed.inject(HttpTestingController);
      const { component } = render([rejected('lic-1')]);
      component.startRevoke(component.allEntries[0]);

      component.revokeRejection(component.allEntries[0]);
      http
        .expectOne((r) =>
          r.url.endsWith('admin/players/42/handle_license_request.json')
        )
        .flush(
          { message: 'Spieler ist gesperrt' },
          { status: 422, statusText: 'Unprocessable Entity' }
        );

      expect(component.revokingLicenseId).toBeNull();
      expect(component.confirmRevokeLicenseId).toBe('lic-1');
      expect(component.allEntries[0].license_status_id).toBe(3);

      component.revokeRejection(component.allEntries[0]);
      http
        .expectOne((r) =>
          r.url.endsWith('admin/players/42/handle_license_request.json')
        )
        .flush({});
      expect(component.allEntries[0].license_status_id).toBe(2);
    });

    // Genau der Fall, fuer den die Klemme in reapplyFiltersKeepingPage da ist:
    // Der letzte Eintrag der letzten Seite verlaesst die Trefferliste, die
    // gemerkte Seitenzahl liegt danach hinter dem Ende.
    it('rueckt eine Seite zurueck, wenn die letzte Seite leer wird', () => {
      const http = TestBed.inject(HttpTestingController);
      const fixture = TestBed.createComponent(LicenseAdminGlobalListComponent);
      const component = fixture.componentInstance;
      component.allEntries = Array.from({ length: 101 }, (_, i) =>
        rejected(`lic-${i}`, i + 1, `Spieler${i}`)
      );
      component.filterStatusId = 3;
      component.applyFilters();
      component.changePage(5);

      component.revokeRejection(component.allEntries[100]);
      http
        .expectOne((r) =>
          r.url.endsWith('admin/players/101/handle_license_request.json')
        )
        .flush({});

      expect(component.numberOfPages).toBe(4);
      expect(component.currentPage).toBe(4);
      expect(component.pagedEntries.length).toBe(25);
    });

    it('schliesst die Rueckfrage beim Abbrechen, ohne etwas zu schicken', () => {
      const http = TestBed.inject(HttpTestingController);
      const { component, root, detectChanges } = render([rejected('lic-1')]);
      component.startRevoke(component.allEntries[0]);
      detectChanges();

      root
        .querySelector<HTMLElement>('[data-testid="revoke-rejection-cancel"]')
        ?.click();

      expect(component.confirmRevokeLicenseId).toBeNull();
      expect(component.revokingLicenseId).toBeNull();
      http.expectNone((r) =>
        r.url.endsWith('admin/players/42/handle_license_request.json')
      );
    });

    // Der zweite Klick wuerde den Statuswechsel nicht wiederholen (die API sieht
    // dann keinen Unterschied mehr), aber eine zweite Erfolgsmeldung erzeugen.
    it('schickt einen laufenden Widerruf nicht zweimal los', () => {
      const http = TestBed.inject(HttpTestingController);
      const { component } = render([rejected('lic-1')]);

      component.revokeRejection(component.allEntries[0]);
      component.revokeRejection(component.allEntries[0]);

      // match() statt expectOne(): Die Zahl der Aufrufe ist hier die Aussage,
      // und ein zweiter Aufruf soll als "2 statt 1" scheitern, nicht als
      // "mehr als eine Uebereinstimmung".
      const requests = http.match((r) =>
        r.url.endsWith('admin/players/42/handle_license_request.json')
      );
      expect(requests.length).toBe(1);
      requests[0].flush({});
    });
  });
  // ---------------------------------------------------------------------------
  // Sperren (api#605)
  // ---------------------------------------------------------------------------

  describe('Sperren', () => {
    function suspendedEntry(): AdminLicenseEntry {
      return {
        player_id: 42,
        player_last_name: 'Gesperrt',
        player_first_name: 'Test',
        league_id: 1,
        league_name: 'Liga',
        team_name: 'Team',
        license_status_id: 9,
        license_status: 'gesperrt',
        base_status_id: 1,
        base_status: 'erteilt',
        suspension: {
          id: 7,
          scope_kind: 'competition',
          scope_summary: 'Herren Großfeld, Ligaspielbetrieb',
          valid_from: '2026-09-01',
          valid_until: null,
          games_total: 3,
          games_served: 1,
          remaining_games: 2,
          reason: 'Tätlichkeit',
        },
      } as AdminLicenseEntry;
    }

    it('färbt gesperrt rot wie eine Ablehnung', () => {
      const component = TestBed.createComponent(
        LicenseAdminGlobalListComponent
      ).componentInstance;

      expect(component.statusBadgeClass(9)).toContain('red');
      expect(component.statusBadgeClass(1)).toContain('green');
    });

    it('hebt eine Sperre auf und lädt danach neu', () => {
      const fixture = TestBed.createComponent(LicenseAdminGlobalListComponent);
      const component = fixture.componentInstance;
      const http = TestBed.inject(HttpTestingController);
      component.canLiftSuspension = true;
      const load = spyOn(component, 'load');

      component.liftSuspension(suspendedEntry(), 7);

      const req = http.expectOne((r) =>
        r.url.includes('admin/players/42/suspensions/7')
      );
      expect(req.request.method).toBe('DELETE');
      req.flush({});
      expect(load).toHaveBeenCalled();
    });

    it('ohne Recht wird nicht aufgehoben', () => {
      const fixture = TestBed.createComponent(LicenseAdminGlobalListComponent);
      const component = fixture.componentInstance;
      const http = TestBed.inject(HttpTestingController);
      component.canLiftSuspension = false;

      component.liftSuspension(suspendedEntry(), 7);

      // Kein Aufruf: Ohne Recht faellt der Knopf im Template weg, und die
      // Methode faellt zusaetzlich zu -- der Endpunkt selbst prueft ohnehin.
      http.expectNone((r) => r.url.includes('suspensions'));
    });
  });
});
