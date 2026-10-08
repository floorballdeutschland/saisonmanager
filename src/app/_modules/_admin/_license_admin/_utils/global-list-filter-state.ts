import { Injectable } from '@angular/core';

// Filterauswahl der Lizenzverwaltung (Verband). Wer aus der gefilterten Liste
// einen Antrag öffnet und genehmigt, kommt über "Zurück" oder den Browser auf
// eine neu erzeugte Liste – ohne diesen Zwischenspeicher stünde dort wieder
// "Alle Status". Bewusst nur im Speicher und nicht im localStorage: Erst ein
// Neuladen der Seite beginnt wieder mit der ungefilterten Liste. Ein Wechsel in
// einen anderen Menüpunkt und zurück behält die Auswahl dagegen bei.
//
// Die Auswahl gehört zu dem Konto, das sie getroffen hat. Ab- und Anmelden
// lädt die Seite nicht neu; ohne diese Bindung sähe die nächste Person im
// selben Tab die Suchbegriffe der vorigen, und ein Verband aus deren Scope,
// den sie selbst nicht hat, filterte ihre Liste unsichtbar leer.
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
  private _userId: number | null = null;

  filtersFor(userId: number | null): LicenseGlobalListFilters | null {
    return this._filters && this._userId === userId ? this._filters : null;
  }

  save(filters: LicenseGlobalListFilters, userId: number | null): void {
    this._filters = { ...filters };
    this._userId = userId;
  }

  clear(): void {
    this._filters = null;
    this._userId = null;
  }
}
