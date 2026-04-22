import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { ApiKeyService, NotificationService } from '@floorball/core';
import { ApiKey } from '@floorball/types';

@Component({
  templateUrl: './api-key-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApiKeyIndexComponent implements OnInit, OnDestroy {
  apiKeys: ApiKey[] = [];
  loading = false;
  newKeyName = '';
  createdKey: string | null = null;
  creating = false;
  togglingIds = new Set<number>();

  private _destroy$ = new Subject<void>();

  constructor(
    private _apiKeyService: ApiKeyService,
    private _notificationService: NotificationService,
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
            'API-Keys konnten nicht geladen werden.',
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
        error: (err: HttpErrorResponse) => {
          const detail = err.error?.errors?.join(', ') ?? err.message;
          this._notificationService.error(`Fehler beim Erstellen: ${detail}`, {
            autoClose: false,
          });
          this.creating = false;
          this._cdr.markForCheck();
        },
      });
  }

  toggleActive(key: ApiKey): void {
    if (this.togglingIds.has(key.id)) return;
    this.togglingIds.add(key.id);
    this._apiKeyService
      .update(key.id, !key.active)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.togglingIds.delete(key.id);
          this.load();
        },
        error: (err: HttpErrorResponse) => {
          this.togglingIds.delete(key.id);
          const detail = err.error?.errors?.join(', ') ?? err.message;
          this._notificationService.error(
            `Fehler beim Aktualisieren: ${detail}`,
            { autoClose: false }
          );
          this._cdr.markForCheck();
        },
      });
  }

  delete(key: ApiKey): void {
    if (!confirm(`API-Key "${key.name}" wirklich löschen?`)) return;
    this._apiKeyService
      .delete(key.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this._notificationService.success(`"${key.name}" gelöscht.`, {
            autoClose: true,
          });
          this.load();
        },
        error: (err: HttpErrorResponse) => {
          const detail = err.error?.errors?.join(', ') ?? err.message;
          this._notificationService.error(`Fehler beim Löschen: ${detail}`, {
            autoClose: false,
          });
        },
      });
  }

  dismissCreatedKey(): void {
    this.createdKey = null;
    this._cdr.markForCheck();
  }
}
