import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { ClubService } from '@floorball/core';
import { ClubLicenseCounts, ClubLicenseSummary } from '@floorball/types';

/**
 * Zahl der Lizenzen eines Vereins je Mannschaft und Status, mit Saisonauswahl.
 * Nur fuer den VM des Vereins: Die API antwortet allen anderen mit 403, und der
 * ErrorInterceptor wuerde darauf umleiten. Der Aufrufer bindet die Komponente
 * deshalb nur fuer eigene Vereine ein.
 */
@Component({
  selector: 'fb-license-club-summary',
  templateUrl: './license-club-summary.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class LicenseClubSummaryComponent implements OnInit {
  @Input({ required: true }) clubId!: number;

  summary: ClubLicenseSummary | null = null;

  /**
   * Auswahl getrennt von den Zahlen gehalten: Scheitert ein Saisonwechsel,
   * verschwindet die Tabelle, die Auswahl aber bleibt, sonst kaeme man ohne
   * Neuladen der Seite nicht mehr zurueck.
   */
  seasons: { id: number; name: string }[] = [];
  seasonId: number | null = null;
  loading = false;
  loadFailed = false;

  readonly columns: (keyof ClubLicenseCounts)[] = [
    'approved',
    'requested',
    'denied',
    'withdrawn',
    'other',
    'total',
  ];

  constructor(
    private _clubService: ClubService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load(null);
  }

  selectSeason(value: string): void {
    this.load(value ? Number(value) : null);
  }

  load(seasonId: number | null): void {
    this.seasonId = seasonId;
    this.loading = true;
    this.loadFailed = false;
    this._cdr.markForCheck();
    this._clubService.vmGetLicenseSummary(this.clubId, seasonId).subscribe({
      next: (summary) => {
        this.summary = summary;
        this.seasons = summary.seasons;
        this.seasonId = summary.season_id;
        this.loading = false;
        this._cdr.markForCheck();
      },
      error: () => {
        // Keine alte Saison unter einer neuen Auswahl stehen lassen.
        this.summary = null;
        this.loading = false;
        this.loadFailed = true;
        this._cdr.markForCheck();
      },
    });
  }
}
