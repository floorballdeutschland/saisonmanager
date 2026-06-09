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
import { PenaltyCode } from '@floorball/types';

@Component({
  templateUrl: './referee-settings.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class RefereeSettingsComponent implements OnInit, OnDestroy {
  penaltyCodes: PenaltyCode[] = [];
  loading = false;
  saving = false;
  editingId: string | null = null;
  editBuffer: Partial<PenaltyCode> = {};
  newCode: Partial<PenaltyCode> = { active: true };
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
      .adminGetPenaltyCodes()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.penaltyCodes = result;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }

  isValidCode(code: string | undefined): boolean {
    return /^\d{3}$/.test((code ?? '').trim());
  }

  startEdit(code: PenaltyCode): void {
    this.editingId = code.id;
    this.editBuffer = { ...code };
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editBuffer = {};
  }

  saveEdit(): void {
    if (
      !this.editingId ||
      !this.isValidCode(this.editBuffer.code) ||
      !this.editBuffer.description?.trim()
    ) {
      return;
    }
    this.saving = true;
    this._refereeService
      .adminUpdatePenaltyCode(this.editingId, this.editBuffer)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.penaltyCodes = this.penaltyCodes.map((c) =>
            c.id === updated.id ? updated : c
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
        error: (err) => {
          this.saving = false;
          this._notificationService.error(
            err?.error?.error || 'Fehler beim Speichern.',
            { autoClose: false, keepAfterRouteChange: false }
          );
          this._cdr.markForCheck();
        },
      });
  }

  create(): void {
    if (
      !this.isValidCode(this.newCode.code) ||
      !this.newCode.description?.trim()
    ) {
      return;
    }
    this.saving = true;
    this._refereeService
      .adminCreatePenaltyCode(this.newCode)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (created) => {
          this.penaltyCodes = [...this.penaltyCodes, created];
          this.newCode = { active: true };
          this.showNewForm = false;
          this.saving = false;
          this._notificationService.success('Strafcode angelegt.', {
            autoClose: true,
            keepAfterRouteChange: false,
          });
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.saving = false;
          this._notificationService.error(
            err?.error?.error || 'Fehler beim Anlegen.',
            { autoClose: false, keepAfterRouteChange: false }
          );
          this._cdr.markForCheck();
        },
      });
  }

  delete(code: PenaltyCode): void {
    if (
      !confirm(
        `Strafcode „${code.code} – ${code.description}" wirklich löschen?`
      )
    ) {
      return;
    }
    this._refereeService
      .adminDeletePenaltyCode(code.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.penaltyCodes = this.penaltyCodes.filter((c) => c.id !== code.id);
          this._notificationService.success('Gelöscht.', {
            autoClose: true,
            keepAfterRouteChange: false,
          });
          this._cdr.markForCheck();
        },
        error: () => {
          this._notificationService.error('Löschen nicht möglich.', {
            autoClose: false,
            keepAfterRouteChange: false,
          });
          this._cdr.markForCheck();
        },
      });
  }
}
