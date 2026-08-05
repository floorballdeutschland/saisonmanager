import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import {
  ApiKeyDailyCount,
  ApiKeyEndpointCount,
  ApiKeyMonthlyCount,
  ApiKeyService,
  ApiKeyUsageData,
} from '@floorball/core';

type SortKey = 'endpoint' | 'count';

/**
 * Nutzung eines einzelnen API-Keys: Verlauf über 30 Tage und zwölf Monate sowie
 * die Endpunkte nach Häufigkeit. Grundlage für die Frage, wo ein Rate-Limit
 * nötig ist, statt es vorsorglich zu setzen.
 *
 * Die Diagramme sind bewusst handgebaute CSS-Balken wie in der allgemeinen
 * Auswertung; das Projekt bringt keine Chart-Bibliothek mit.
 */
@Component({
  templateUrl: './api-key-usage.component.html',
  styleUrls: ['./api-key-usage.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ApiKeyUsageComponent implements OnInit, OnDestroy {
  loading = false;
  loadError: string | null = null;
  data: ApiKeyUsageData | null = null;

  sortKey: SortKey = 'count';

  private _keyId = 0;
  private _destroy$ = new Subject<void>();

  constructor(
    private _route: ActivatedRoute,
    private _apiKeyService: ApiKeyService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._keyId = Number(this._route.snapshot.paramMap.get('id') ?? 0);
    this.load();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  load(): void {
    if (!this._keyId) {
      this.loadError = this._transloco.translate('apiKeys.usage.loadError');
      return;
    }

    this.loading = true;
    this.loadError = null;
    this._apiKeyService
      .getUsage(this._keyId)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.data = result;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loadError = this._transloco.translate('apiKeys.usage.loadError');
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }

  get last30Days(): ApiKeyDailyCount[] {
    return this.data?.last_30_days ?? [];
  }

  get lastYear(): ApiKeyMonthlyCount[] {
    return this.data?.last_year ?? [];
  }

  get total30Days(): number {
    return this.last30Days.reduce((sum, d) => sum + d.count, 0);
  }

  get peakDay(): number {
    return this.last30Days.reduce((max, d) => Math.max(max, d.count), 0);
  }

  get currentMonthTotal(): number {
    // Wie in der allgemeinen Auswertung nach UTC gerechnet, weil die
    // Monats-Gruppierung serverseitig aus dem Datum ohne Zeitzone entsteht.
    const now = new Date();
    const month = `${now.getUTCFullYear()}-${String(
      now.getUTCMonth() + 1
    ).padStart(2, '0')}`;
    return this.lastYear.find((m) => m.month === month)?.count ?? 0;
  }

  get endpoints(): ApiKeyEndpointCount[] {
    const list = [...(this.data?.by_endpoint ?? [])];
    return this.sortKey === 'endpoint'
      ? list.sort((a, b) => a.endpoint.localeCompare(b.endpoint))
      : list.sort((a, b) => b.count - a.count);
  }

  get endpointTotal(): number {
    return (this.data?.by_endpoint ?? []).reduce((sum, e) => sum + e.count, 0);
  }

  setSort(key: SortKey): void {
    this.sortKey = key;
    this._cdr.markForCheck();
  }

  share(count: number): number {
    if (!this.endpointTotal) return 0;
    return (count / this.endpointTotal) * 100;
  }

  dailyHeight(count: number): number {
    return (count / Math.max(this.peakDay, 1)) * 100;
  }

  monthlyHeight(count: number): number {
    const max = this.lastYear.reduce((m, entry) => Math.max(m, entry.count), 1);
    return (count / max) * 100;
  }

  formatDay(dateStr: string): string {
    // T00:00:00Z erzwingt UTC-Auswertung, sonst kippt das Datum abends in CEST.
    const d = new Date(dateStr + 'T00:00:00Z');
    return `${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
  }

  formatMonth(monthStr: string): string {
    const [year, month] = monthStr.split('-');
    return `${parseInt(month, 10)}/${year.slice(2)}`;
  }
}
