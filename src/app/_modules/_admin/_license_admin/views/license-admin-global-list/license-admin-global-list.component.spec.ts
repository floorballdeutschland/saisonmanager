import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { getTranslocoTestingModule } from '@floorball/core';
import { AdminLicenseEntry } from '@floorball/types';

import { LicenseAdminGlobalListComponent } from './license-admin-global-list.component';

describe('LicenseAdminGlobalListComponent', () => {
  beforeEach(async () => {
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

  describe('pagination', () => {
    it('splits the entries into pages of pageSize', () => {
      const component = setup(120);

      expect(component.pageSize).toBe(50);
      expect(component.numberOfPages).toBe(3);
      expect(component.pagedEntries.length).toBe(50);
      expect(component.pagedEntries[0].player_last_name).toBe('Spieler0');
    });

    it('serves the requested page', () => {
      const component = setup(120);

      component.changePage(3);

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
      expect(component.pagedEntries.length).toBe(50);
    });
  });
});
