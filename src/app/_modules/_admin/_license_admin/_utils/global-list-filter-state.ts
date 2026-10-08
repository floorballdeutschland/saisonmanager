import { Injectable } from '@angular/core';

// Filterauswahl der Lizenzverwaltung (Verband). Wer aus der gefilterten Liste
// einen Antrag öffnet und genehmigt, kommt über "Zurück" oder den Browser auf
// eine neu erzeugte Liste – ohne diesen Zwischenspeicher stünde dort wieder
// "Alle Status". Bewusst nur im Speicher und nicht im localStorage: Ein Neuladen
// oder der nächste Besuch beginnt mit der ungefilterten Liste, damit niemand
// tags darauf vor einer scheinbar halbleeren Liste sitzt.
export interface LicenseGlobalListFilters {
  search: string;
  clubSearch: string;
  filterSeasonId: number | null;
  filterGameOperationId: number | null;
  filterLeagueId: number | null;
  filterFieldSize: string | null;
  filterFemale: boolean | null;
  filterAgeGroup: string | null;
  filterLeagueClassId: string | null;
  filterLeagueType: string | null;
  filterStatusId: number | null;
  filterLicenseType: string | null;
  filterGfRole: string | null;
  filterExpressOnly: boolean;
  currentPage: number;
}

@Injectable({
  providedIn: 'root',
})
export class LicenseGlobalListFilterState {
  private _filters: LicenseGlobalListFilters | null = null;

  get filters(): LicenseGlobalListFilters | null {
    return this._filters;
  }

  save(filters: LicenseGlobalListFilters): void {
    this._filters = { ...filters };
  }

  clear(): void {
    this._filters = null;
  }
}
