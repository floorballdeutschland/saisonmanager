import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { getTranslocoTestingModule } from '@floorball/core';
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
});
