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
import { RefereeQualificationType } from '@floorball/types';

@Component({
  templateUrl: './referee-qualification-types.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RefereeQualificationTypesComponent implements OnInit, OnDestroy {
  types: RefereeQualificationType[] = [];
  loading = false;
  saving = false;
  editingId: number | null = null;
  editBuffer: Partial<RefereeQualificationType> = {};
  newType: Partial<RefereeQualificationType> = { active: true };
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
      .adminGetQualificationTypes()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.types = result;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }

  startEdit(type: RefereeQualificationType): void {
    this.editingId = type.id;
    this.editBuffer = { ...type };
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editBuffer = {};
  }

  saveEdit(): void {
    if (!this.editingId || !this.editBuffer.name?.trim()) return;
    this.saving = true;
    this._refereeService
      .adminUpdateQualificationType(this.editingId, this.editBuffer)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.types = this.types.map((t) =>
            t.id === updated.id ? updated : t
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
    if (!this.newType.name?.trim()) return;
    this.saving = true;
    this._refereeService
      .adminCreateQualificationType(this.newType)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (created) => {
          this.types = [...this.types, created].sort((a, b) =>
            a.name.localeCompare(b.name)
          );
          this.newType = { active: true };
          this.showNewForm = false;
          this.saving = false;
          this._notificationService.success('Qualifikationstyp angelegt.', {
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

  delete(type: RefereeQualificationType): void {
    if (!confirm(`Qualifikationstyp „${type.name}" wirklich löschen?`)) return;
    this._refereeService
      .adminDeleteQualificationType(type.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.types = this.types.filter((t) => t.id !== type.id);
          this._notificationService.success('Gelöscht.', {
            autoClose: true,
            keepAfterRouteChange: false,
          });
          this._cdr.markForCheck();
        },
        error: () => {
          this._notificationService.error(
            'Löschen nicht möglich. Möglicherweise wird der Typ noch verwendet.',
            { autoClose: false, keepAfterRouteChange: false }
          );
          this._cdr.markForCheck();
        },
      });
  }
}
