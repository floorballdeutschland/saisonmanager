import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { NotificationService, RefereeService } from '@floorball/core';
import { RefereeLicenseLevel } from '@floorball/types';

@Component({
  templateUrl: './referee-license-levels.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class RefereeLicenseLevelsComponent implements OnInit, OnDestroy {
  levels: RefereeLicenseLevel[] = [];
  loading = false;
  saving = false;
  editingId: number | null = null;
  editBuffer: Partial<RefereeLicenseLevel> = {};
  newLevel: Partial<RefereeLicenseLevel> = { active: true, validity_years: 2 };
  showNewForm = false;

  private _destroy$ = new Subject<void>();

  constructor(
    private _refereeService: RefereeService,
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
    this._refereeService
      .adminGetLicenseLevels()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.levels = result;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }

  startEdit(level: RefereeLicenseLevel): void {
    this.editingId = level.id;
    this.editBuffer = { ...level };
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editBuffer = {};
  }

  saveEdit(): void {
    if (!this.editingId || !this.editBuffer.name?.trim()) return;
    this.saving = true;
    this._refereeService
      .adminUpdateLicenseLevel(this.editingId, this.editBuffer)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.levels = this.levels.map((l) =>
            l.id === updated.id ? updated : l
          );
          this.editingId = null;
          this.editBuffer = {};
          this.saving = false;
          this._notificationService.success('Gespeichert.', {
            autoClose: true,
            keepAfterRouteChange: false,
          });
          this._cdr.markForCheck();
        },
        error: () => {
          this.saving = false;
          this._notificationService.error('Fehler beim Speichern.', {
            autoClose: false,
            keepAfterRouteChange: false,
          });
          this._cdr.markForCheck();
        },
      });
  }

  create(): void {
    if (!this.newLevel.name?.trim()) return;
    this.saving = true;
    this._refereeService
      .adminCreateLicenseLevel(this.newLevel)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (created) => {
          this.levels = [...this.levels, created];
          this.newLevel = { active: true, validity_years: 2 };
          this.showNewForm = false;
          this.saving = false;
          this._notificationService.success('Lizenzstufe angelegt.', {
            autoClose: true,
            keepAfterRouteChange: false,
          });
          this._cdr.markForCheck();
        },
        error: () => {
          this.saving = false;
          this._notificationService.error('Fehler beim Anlegen.', {
            autoClose: false,
            keepAfterRouteChange: false,
          });
          this._cdr.markForCheck();
        },
      });
  }

  delete(level: RefereeLicenseLevel): void {
    if (!confirm(`Lizenzstufe „${level.name}" wirklich löschen?`)) return;
    this._refereeService
      .adminDeleteLicenseLevel(level.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.levels = this.levels.filter((l) => l.id !== level.id);
          this._notificationService.success('Gelöscht.', {
            autoClose: true,
            keepAfterRouteChange: false,
          });
          this._cdr.markForCheck();
        },
        error: () => {
          this._notificationService.error(
            'Löschen nicht möglich. Möglicherweise wird die Stufe noch verwendet.',
            { autoClose: false, keepAfterRouteChange: false }
          );
          this._cdr.markForCheck();
        },
      });
  }
}
