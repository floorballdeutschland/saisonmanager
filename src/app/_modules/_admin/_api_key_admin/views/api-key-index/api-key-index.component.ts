import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { ApiKeyService, NotificationService } from '@floorball/core';
import { API_KEY_FEATURES, ApiKey, ApiKeyFeature } from '@floorball/types';

@Component({
  templateUrl: './api-key-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ApiKeyIndexComponent implements OnInit, OnDestroy {
  apiKeys: ApiKey[] = [];
  loading = false;
  newKeyName = '';
  createdKey: string | null = null;
  creating = false;
  togglingIds = new Set<number>();
  rateLimitEdits: Record<number, string> = {};
  readonly features = API_KEY_FEATURES;

  private _destroy$ = new Subject<void>();

  constructor(
    private _apiKeyService: ApiKeyService,
    private _notificationService: NotificationService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  load(): void {
    this.loading = true;
    this._apiKeyService
      .getAll()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.apiKeys = result;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._notificationService.error(
            this._transloco.translate('apiKeys.notifications.loadError'),
            { autoClose: false }
          );
          this._cdr.markForCheck();
        },
      });
  }

  create(): void {
    if (!this.newKeyName.trim()) return;
    this.creating = true;
    this._apiKeyService
      .create(this.newKeyName.trim())
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.createdKey = result.raw_key;
          this.newKeyName = '';
          this.creating = false;
          this._cdr.markForCheck();
          this.load();
        },
        error: () => {
          this.creating = false;
          this._cdr.markForCheck();
        },
      });
  }

  toggleActive(key: ApiKey): void {
    this._patch(key.id, { active: !key.active });
  }

  toggleRealtime(key: ApiKey): void {
    this._patch(key.id, { realtime: !key.realtime });
  }

  hasFeature(key: ApiKey, feature: ApiKeyFeature): boolean {
    return (key.features ?? []).includes(feature);
  }

  toggleFeature(key: ApiKey, feature: ApiKeyFeature): void {
    const current = key.features ?? [];
    const features = current.includes(feature)
      ? current.filter((f) => f !== feature)
      : [...current, feature];
    this._patch(key.id, { features });
  }

  rateLimitInput(key: ApiKey): string {
    return this.rateLimitEdits[key.id] ?? key.rate_limit?.toString() ?? '';
  }

  onRateLimitChange(key: ApiKey, value: string): void {
    this.rateLimitEdits[key.id] = value;
  }

  saveRateLimit(key: ApiKey): void {
    const raw = this.rateLimitEdits[key.id];
    if (raw === undefined) return;
    const parsed = raw.trim() === '' ? null : parseInt(raw, 10);
    if (raw.trim() !== '' && (isNaN(parsed!) || parsed! <= 0)) {
      this._notificationService.error(
        this._transloco.translate('apiKeys.notifications.rateLimitInvalid'),
        { autoClose: true }
      );
      return;
    }
    if (this.togglingIds.has(key.id)) return;
    delete this.rateLimitEdits[key.id];
    this._patch(key.id, { rate_limit: parsed });
  }

  private _patch(
    id: number,
    patch: Parameters<ApiKeyService['update']>[1]
  ): void {
    if (this.togglingIds.has(id)) return;
    this.togglingIds.add(id);
    this._apiKeyService
      .update(id, patch)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        // Die Zeile sofort durch den Stand der Antwort ersetzen, nicht erst
        // nach dem Neuladen: `features` geht als ganze Liste hinaus, ein
        // zweiter Klick auf den alten Stand würde die erste Freigabe wieder
        // entziehen. Die Antwort trägt weder Nutzung noch Antrag, daher
        // gemischt.
        next: (updated) => {
          this.togglingIds.delete(id);
          this._replaceRow(id, updated);
        },
        // Neues Zeilenobjekt auch im Fehlerfall: Ein Häkchen hat der Browser
        // schon umgeschaltet, und `[checked]` schreibt nur bei geändertem
        // Wert zurück. Erst das neu aufgebaute Zeilenobjekt setzt es zurück.
        error: () => {
          this.togglingIds.delete(id);
          this._replaceRow(id, {});
        },
      });
  }

  private _replaceRow(id: number, changes: Partial<ApiKey>): void {
    this.apiKeys = this.apiKeys.map((k) =>
      k.id === id ? { ...k, ...changes } : k
    );
    this._cdr.markForCheck();
  }

  delete(key: ApiKey): void {
    if (
      !confirm(
        this._transloco.translate('apiKeys.confirmDelete', { name: key.name })
      )
    )
      return;
    this._apiKeyService
      .delete(key.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this._notificationService.success(
            this._transloco.translate('apiKeys.notifications.deleted', {
              name: key.name,
            }),
            { autoClose: true }
          );
          this.load();
        },
        // Fehlermeldungen zeigt der globale ErrorInterceptor (#84).
      });
  }

  dismissCreatedKey(): void {
    this.createdKey = null;
    this._cdr.markForCheck();
  }
}
