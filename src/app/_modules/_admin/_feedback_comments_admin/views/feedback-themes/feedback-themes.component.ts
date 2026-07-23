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
import { FeedbackCommentsService, NotificationService } from '@floorball/core';
import { FeedbackTheme } from '@floorball/types';

@Component({
  templateUrl: './feedback-themes.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class FeedbackThemesComponent implements OnInit, OnDestroy {
  themes: FeedbackTheme[] = [];
  loading = false;
  saving = false;
  editingId: number | null = null;
  editBuffer: Partial<FeedbackTheme> = {};
  newTheme: Partial<FeedbackTheme> = { color: '#2563eb' };
  showNewForm = false;

  private _destroy$ = new Subject<void>();

  constructor(
    private _service: FeedbackCommentsService,
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
    this._service
      .getThemes()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.themes = result;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }

  startEdit(theme: FeedbackTheme): void {
    this.editingId = theme.id;
    this.editBuffer = { ...theme };
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editBuffer = {};
  }

  saveEdit(): void {
    if (!this.editingId || !this.editBuffer.name?.trim()) return;
    this.saving = true;
    this._service
      .updateTheme(this.editingId, this.editBuffer)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.themes = this.themes.map((t) =>
            t.id === updated.id ? updated : t
          );
          this.editingId = null;
          this.editBuffer = {};
          this.saving = false;
          this._notificationService.success(
            this._transloco.translate('feedbackComments.themes.saved'),
            { autoClose: true }
          );
          this._cdr.markForCheck();
        },
        error: () => {
          this.saving = false;
          this._notificationService.error(
            this._transloco.translate('feedbackComments.themes.saveError'),
            { autoClose: false }
          );
          this._cdr.markForCheck();
        },
      });
  }

  create(): void {
    if (!this.newTheme.name?.trim()) return;
    this.saving = true;
    const payload: Partial<FeedbackTheme> = {
      name: this.newTheme.name.trim(),
      color: this.newTheme.color,
      position: this.themes.length,
    };
    this._service
      .createTheme(payload)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (created) => {
          this.themes = [...this.themes, created];
          this.newTheme = { color: '#2563eb' };
          this.showNewForm = false;
          this.saving = false;
          this._notificationService.success(
            this._transloco.translate('feedbackComments.themes.created'),
            { autoClose: true }
          );
          this._cdr.markForCheck();
        },
        error: () => {
          this.saving = false;
          this._notificationService.error(
            this._transloco.translate('feedbackComments.themes.createError'),
            { autoClose: false }
          );
          this._cdr.markForCheck();
        },
      });
  }

  delete(theme: FeedbackTheme): void {
    if (
      !confirm(
        this._transloco.translate('feedbackComments.themes.confirmDelete', {
          name: theme.name,
        })
      )
    )
      return;
    this._service
      .deleteTheme(theme.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.themes = this.themes.filter((t) => t.id !== theme.id);
          this._notificationService.success(
            this._transloco.translate('feedbackComments.themes.deleted'),
            { autoClose: true }
          );
          this._cdr.markForCheck();
        },
        error: () => {
          this._notificationService.error(
            this._transloco.translate('feedbackComments.themes.deleteError'),
            { autoClose: false }
          );
          this._cdr.markForCheck();
        },
      });
  }
}
