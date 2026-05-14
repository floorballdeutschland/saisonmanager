import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { AdminLicenseEntry } from '@floorball/types';
import { LeagueService } from '@floorball/core';
import { Title } from '@angular/platform-browser';

interface FilterOption {
  value: string | number | boolean | null;
  label: string;
}

@Component({
  selector: 'fb-license-admin-global-list',
  templateUrl: './license-admin-global-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LicenseAdminGlobalListComponent implements OnInit {
  allEntries: AdminLicenseEntry[] = [];
  filteredEntries: AdminLicenseEntry[] = [];
  loading = true;
  loadError = false;

  gameOperationOptions: FilterOption[] = [];
  leagueOptions: FilterOption[] = [];
  categoryOptions: FilterOption[] = [];
  statusOptions: FilterOption[] = [
    { value: null, label: 'Alle Status' },
    { value: 1, label: 'Erteilt' },
    { value: 2, label: 'Beantragt' },
    { value: 3, label: 'Abgelehnt' },
    { value: 8, label: 'Zurückgezogen' },
  ];
  fieldSizeOptions: FilterOption[] = [
    { value: null, label: 'Alle Spielformen' },
    { value: 'GF', label: 'Großfeld' },
    { value: 'KF', label: 'Kleinfeld' },
  ];

  search = '';
  clubSearch = '';
  filterGameOperationId: number | null = null;
  filterLeagueId: number | null = null;
  filterFieldSize: string | null = null;
  filterFemale: boolean | null = null;
  filterCategoryId: string | null = null;
  filterLeagueType: string | null = null;
  filterStatusId: number | null = null;
  filterLicenseType: string | null = null;
  filterExpressOnly = false;

  constructor(
    private _leagueService: LeagueService,
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title
  ) {
    this._metaTitle.setTitle('Floorball Saisonmanager Lizenzverwaltung');
  }

  ngOnInit(): void {
    this.load();
  }

  public load(): void {
    this.loading = true;
    this.loadError = false;
    this._leagueService.getAdminLicenses().subscribe({
      next: (entries) => {
        this.allEntries = entries;
        this.buildFilterOptions();
        this.applyFilters();
        this.loading = false;
        this._cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.loadError = true;
        this._cdr.markForCheck();
      },
    });
  }

  public onGameOperationChange(): void {
    this.filterLeagueId = null;
    this.buildLeagueOptions();
    this.applyFilters();
  }

  public applyFilters(): void {
    const s = this.search.toLowerCase().trim();
    const c = this.clubSearch.toLowerCase().trim();

    this.filteredEntries = this.allEntries.filter((e) => {
      if (
        s &&
        !`${e.player_last_name} ${e.player_first_name}`
          .toLowerCase()
          .includes(s)
      )
        return false;
      if (c && !(e.club_name ?? '').toLowerCase().includes(c)) return false;
      if (
        this.filterGameOperationId &&
        e.game_operation_id !== this.filterGameOperationId
      )
        return false;
      if (this.filterLeagueId && e.league_id !== this.filterLeagueId)
        return false;
      if (this.filterFieldSize && e.field_size !== this.filterFieldSize)
        return false;
      if (this.filterFemale !== null && e.female !== this.filterFemale)
        return false;
      if (
        this.filterCategoryId &&
        e.league_category_id !== this.filterCategoryId
      )
        return false;
      if (this.filterLeagueType && e.league_type !== this.filterLeagueType)
        return false;
      if (
        this.filterStatusId !== null &&
        e.license_status_id !== this.filterStatusId
      )
        return false;
      if (this.filterLicenseType && e.license_type !== this.filterLicenseType)
        return false;
      if (this.filterExpressOnly && !e.express) return false;
      return true;
    });
  }

  public resetFilters(): void {
    this.search = '';
    this.clubSearch = '';
    this.filterGameOperationId = null;
    this.filterLeagueId = null;
    this.filterFieldSize = null;
    this.filterFemale = null;
    this.filterCategoryId = null;
    this.filterLeagueType = null;
    this.filterStatusId = null;
    this.filterLicenseType = null;
    this.filterExpressOnly = false;
    this.buildLeagueOptions();
    this.applyFilters();
  }

  public exportCsv(): void {
    const headers = [
      'Nachname',
      'Vorname',
      'Geburtsjahr',
      'Verein',
      'Team',
      'Spielbetrieb',
      'Liga',
      'Status',
      'Lizenztyp',
      'Express',
      'Beantragt',
      'Erteilt',
    ];
    const rows = this.filteredEntries.map((e) => [
      e.player_last_name,
      e.player_first_name,
      this._safeYear(e.player_birthdate),
      e.club_name ?? '',
      e.team_name,
      e.game_operation_name ?? '',
      e.league_name,
      e.license_status,
      e.license_type === 'primary' ? 'Erstlizenz' : 'Zweitlizenz',
      e.express ? 'Ja' : 'Nein',
      e.requested_at ? this._formatDate(e.requested_at) : '',
      e.approved_at ? this._formatDate(e.approved_at) : '',
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')
      )
      .join('\r\n');

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lizenzen-${yyyy}-${mm}-${dd}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 0);
  }

  public statusBadgeClass(statusId: number): string {
    if (statusId === 1) return 'bg-green-100 text-green-800';
    if (statusId === 2) return 'bg-yellow-100 text-yellow-800';
    if (statusId === 3) return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-600';
  }

  public fieldSizeLabel(fieldSize: string): string {
    if (fieldSize === 'GF') return 'GF';
    if (fieldSize === 'KF') return 'KF';
    return fieldSize;
  }

  public isMinor(birthdate: string): boolean {
    if (!birthdate) return false;
    const dob = new Date(birthdate);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    if (
      today.getMonth() < dob.getMonth() ||
      (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())
    ) {
      age--;
    }
    return age < 18;
  }

  private _formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return `${String(d.getDate()).padStart(2, '0')}.${String(
      d.getMonth() + 1
    ).padStart(2, '0')}.${d.getFullYear()}`;
  }

  private _safeYear(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '' : d.getFullYear().toString();
  }

  private buildFilterOptions(): void {
    const goMap = new Map<number, string>();
    const catMap = new Map<string, string>();

    for (const e of this.allEntries) {
      if (e.game_operation_id)
        goMap.set(
          e.game_operation_id,
          e.game_operation_name ?? String(e.game_operation_id)
        );
      if (e.league_category_id)
        catMap.set(
          e.league_category_id,
          e.league_category_name ?? e.league_category_id
        );
    }

    this.gameOperationOptions = [
      { value: null, label: 'Alle Spielbetriebe' },
      ...Array.from(goMap.entries()).map(([id, name]) => ({
        value: id,
        label: name,
      })),
    ];
    this.categoryOptions = [
      { value: null, label: 'Alle Altersklassen' },
      ...Array.from(catMap.entries()).map(([id, name]) => ({
        value: id,
        label: name,
      })),
    ];
    this.buildLeagueOptions();
  }

  private buildLeagueOptions(): void {
    const leagueMap = new Map<number, string>();
    for (const e of this.allEntries) {
      if (
        !this.filterGameOperationId ||
        e.game_operation_id === this.filterGameOperationId
      ) {
        leagueMap.set(e.league_id, e.league_name);
      }
    }
    this.leagueOptions = [
      { value: null, label: 'Alle Ligen' },
      ...Array.from(leagueMap.entries()).map(([id, name]) => ({
        value: id,
        label: name,
      })),
    ];
  }
}
