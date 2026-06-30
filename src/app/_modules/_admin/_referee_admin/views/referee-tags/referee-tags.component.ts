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
import { RefereeTag } from '@floorball/types';

@Component({
  templateUrl: './referee-tags.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class RefereeTagsComponent implements OnInit, OnDestroy {
  tags: RefereeTag[] = [];
  loading = false;
  saving = false;
  editingId: number | null = null;
  editBuffer: Partial<RefereeTag> = {};
  newTag: Partial<RefereeTag> = { color: '#2563eb' };
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
      .adminGetTags()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.tags = result;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }

  startEdit(tag: RefereeTag): void {
    this.editingId = tag.id;
    this.editBuffer = { ...tag };
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editBuffer = {};
  }

  saveEdit(): void {
    if (!this.editingId || !this.editBuffer.name?.trim()) return;
    this.saving = true;
    this._refereeService
      .adminUpdateTag(this.editingId, this.editBuffer)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.tags = this.tags.map((t) => (t.id === updated.id ? updated : t));
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
    if (!this.newTag.name?.trim()) return;
    this.saving = true;
    this._refereeService
      .adminCreateTag(this.newTag)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (created) => {
          this.tags = [...this.tags, created].sort((a, b) =>
            a.name.localeCompare(b.name)
          );
          this.newTag = { color: '#2563eb' };
          this.showNewForm = false;
          this.saving = false;
          this._notificationService.success('Tag angelegt.', {
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

  delete(tag: RefereeTag): void {
    if (!confirm(`Tag „${tag.name}" wirklich löschen?`)) return;
    this._refereeService
      .adminDeleteTag(tag.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.tags = this.tags.filter((t) => t.id !== tag.id);
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
