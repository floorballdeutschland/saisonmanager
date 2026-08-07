import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { Subject, takeUntil } from 'rxjs';
import {
  AssociationService,
  RefereeService,
  SessionService,
} from '@floorball/core';
import {
  RefereeAdmin,
  RefereeStatusFilter,
  StateAssociation,
} from '@floorball/types';
import { downloadCsv } from 'src/app/_helpers/_utils/csv-export';

@Component({
  templateUrl: './referee-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class RefereeIndexComponent implements OnInit, OnDestroy {
  referees: RefereeAdmin[] = [];
  stateAssociations: StateAssociation[] = [];
  loading = false;
  canCreate = false;
  isRestricted = false;

  searchQuery = '';
  filterLandesverband = '';
  filterLizenzstufe = '';
  // Leer = Standard der API: alles außer Karriere beendet. Die Beendeten sind
  // das Register alter Lizenznummern und im Alltag nur Rauschen; über diese
  // Auswahl und über die Suche nach der Lizenznummer bleiben sie erreichbar.
  filterStatus: RefereeStatusFilter = '';
  readonly statusOptions: RefereeStatusFilter[] = [
    '',
    'aktiv',
    'abgelaufen',
    'beendet',
    'ohne_nachweis',
    'alle',
  ];
  sortBy: 'name' | 'lizenznummer' = 'name';
  sortDir: 'asc' | 'desc' = 'asc';

  private _destroy$ = new Subject<void>();

  constructor(
    private _refereeService: RefereeService,
    private _associationService: AssociationService,
    private _sessionService: SessionService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._sessionService.currentUser$
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (user) => {
          this.isRestricted = !!user?.permissions['referee_edit_restricted'];
          this.canCreate = !!user?.permissions['referee_can_create'];
          this._cdr.markForCheck();
        },
      });

    this._associationService.stateAssociations$
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.stateAssociations = result;
          this._cdr.markForCheck();
        },
      });
    this.load();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  toggleSort(col: 'name' | 'lizenznummer'): void {
    if (this.sortBy === col) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = col;
      this.sortDir = 'asc';
    }
    this.load();
  }

  load(): void {
    this.loading = true;
    this._refereeService
      .adminGetAll({
        q: this.searchQuery || undefined,
        landesverband: this.filterLandesverband || undefined,
        lizenzstufe: this.filterLizenzstufe || undefined,
        status: this.filterStatus || undefined,
        sort: this.sortBy,
        sort_dir: this.sortDir,
      })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.referees = result;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }

  onSearch(): void {
    this.load();
  }

  // CSV-Export der aktuell gefilterten Liste – dieselben Spalten wie in der
  // Tabelle, ergänzt um die E-Mail-Adresse (liefert die API nur an Rollen mit
  // Zugriff auf Kontaktdaten, sonst bleibt die Spalte leer).
  exportCsv(): void {
    if (this.referees.length === 0) return;
    const t = (key: string) => this._transloco.translate(key);
    const headers = [
      t('refereeAdmin.index.colLicenseNumber'),
      t('refereeAdmin.index.csvLastName'),
      t('refereeAdmin.index.csvFirstName'),
      t('refereeAdmin.index.colLevel'),
      t('refereeAdmin.index.colRegion'),
      t('refereeAdmin.index.colValidity'),
      t('refereeAdmin.index.csvStatus'),
      t('refereeAdmin.index.colClub'),
      t('refereeAdmin.index.csvEmail'),
      t('refereeAdmin.index.colSeasonGames'),
    ];
    const rows = this.referees.map((r) => [
      r.lizenznummer_display || r.lizenznummer,
      r.nachname,
      r.vorname,
      r.lizenzstufe,
      r.landesverband,
      r.gueltigkeit,
      r.guest ? t('refereeAdmin.index.csvGuest') : t(this.statusLabelKey(r)),
      r.club_name,
      r.email,
      r.season_game_count ?? 0,
    ]);

    downloadCsv('schiedsrichter', headers, rows);
  }

  // Fällt die API-Angabe aus (ältere Antwort), bleibt das alte active-Flag die
  // Grundlage, damit die Spalte nie leer bleibt.
  statusLabelKey(referee: RefereeAdmin): string {
    const status =
      referee.license_status ?? (referee.active ? 'active' : 'lapsed');
    return `refereeAdmin.index.status.${status}`;
  }

  statusClass(referee: RefereeAdmin): string {
    switch (referee.license_status ?? (referee.active ? 'active' : 'lapsed')) {
      case 'active':
        return 'text-green-600 font-medium';
      case 'career_ended':
        return 'text-fb-gray-500';
      case 'unknown':
        return 'text-fb-gray-500';
      default:
        return 'text-red-500';
    }
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.filterLandesverband = '';
    this.filterLizenzstufe = '';
    this.filterStatus = '';
    this.sortBy = 'name';
    this.sortDir = 'asc';
    this.load();
  }
}
