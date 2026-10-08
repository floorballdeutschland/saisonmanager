import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import {
  NotificationService,
  RefereeCourseImportService,
} from '@floorball/core';
import { RefereeCourseImport } from '@floorball/types';

@Component({
  templateUrl: './course-import-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class CourseImportIndexComponent implements OnInit, OnDestroy {
  imports: RefereeCourseImport[] = [];
  loading = false;
  uploading = false;
  // Abgeschlossene Importe stehen standardmäßig nicht in der Liste: Mit jedem
  // Kurs wächst sie, und die Arbeit steckt in den wenigen offenen.
  showClosed = false;

  private _destroy$ = new Subject<void>();

  constructor(
    private _service: RefereeCourseImportService,
    private _notify: NotificationService,
    private _router: Router,
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
      .listImports()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.imports = result;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.loading = false;
          this._notify.error(
            err?.error?.error ??
              this._transloco.translate(
                'refereeCourseAdmin.notifications.loadImportsError'
              )
          );
          this._cdr.markForCheck();
        },
      });
  }

  /**
   * Abgeschlossen heißt: Für den Import ist nichts mehr zu tun. Eingereicht
   * zählt nur dazu, wenn keine Zeile mehr auf die Freigabe des
   * Landesverbands wartet; sonst stünde ein Import mit offenen Reviews
   * unsichtbar hinter dem Filter.
   */
  isClosed(imp: RefereeCourseImport): boolean {
    if (imp.status === 'cancelled') return true;
    if (imp.status !== 'submitted') return false;
    return !(imp.progress?.pending_review ?? 0);
  }

  /**
   * Zeilen, die der Importeur noch in der Hand hat: einreichbare und
   * zurückgestellte. `pending_review` zählt zusätzlich die eingereichten, die
   * beim Landesverband warten, und taugt deshalb nicht als „zu bearbeiten".
   * Ein abgebrochener Import hat nichts mehr zu tun, auch wenn seine nie
   * eingereichten Zeilen weiter `pending_review` tragen.
   */
  toEditCount(imp: RefereeCourseImport): number {
    if (imp.status === 'cancelled') return 0;
    return (imp.progress?.submittable ?? 0) + (imp.progress?.deferred ?? 0);
  }

  /**
   * Eingereichte Zeilen, über die der Landesverband noch nicht entschieden
   * hat. Die API schließt abgebrochene Importe aus der Freigabe aus
   * (`awaiting_lv_review`), also hier auch.
   */
  atLvCount(imp: RefereeCourseImport): number {
    if (imp.status === 'cancelled') return 0;
    const pending = imp.progress?.pending_review ?? 0;
    return Math.max(pending - this.toEditCount(imp), 0);
  }

  visibleImports(): RefereeCourseImport[] {
    return this.showClosed
      ? this.imports
      : this.imports.filter((imp) => !this.isClosed(imp));
  }

  closedCount(): number {
    return this.imports.filter((imp) => this.isClosed(imp)).length;
  }

  toggleShowClosed(): void {
    this.showClosed = !this.showClosed;
  }

  static readonly MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const validationError = this.validateFile(file);
    if (validationError) {
      input.value = '';
      this._notify.error(validationError);
      return;
    }

    this.uploading = true;
    this._service
      .uploadCsv(file)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (created) => {
          this.uploading = false;
          input.value = '';
          this._router.navigate(['/verwaltung/schiri-kurse', created.id]);
        },
        error: (err) => {
          this.uploading = false;
          input.value = '';
          this._notify.error(
            err?.error?.error ?? this.errorMessageForStatus(err?.status)
          );
          this._cdr.markForCheck();
        },
      });
  }

  private validateFile(file: File): string | null {
    const name = file.name.toLowerCase();
    if (!name.endsWith('.csv')) {
      return this._transloco.translate(
        'refereeCourseAdmin.notifications.fileNotCsv'
      );
    }
    if (file.size > CourseImportIndexComponent.MAX_FILE_SIZE_BYTES) {
      return this._transloco.translate(
        'refereeCourseAdmin.notifications.fileTooLarge'
      );
    }
    if (file.size === 0) {
      return this._transloco.translate(
        'refereeCourseAdmin.notifications.fileEmpty'
      );
    }
    return null;
  }

  private errorMessageForStatus(status: number | undefined): string {
    switch (status) {
      case 0:
        return this._transloco.translate(
          'refereeCourseAdmin.notifications.uploadNoConnection'
        );
      case 413:
        return this._transloco.translate(
          'refereeCourseAdmin.notifications.uploadFileTooLarge'
        );
      case 415:
        return this._transloco.translate(
          'refereeCourseAdmin.notifications.uploadUnsupportedFormat'
        );
      case 422:
        return this._transloco.translate(
          'refereeCourseAdmin.notifications.uploadCsvUnprocessable'
        );
      default:
        return this._transloco.translate(
          'refereeCourseAdmin.notifications.uploadFailed'
        );
    }
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'in_review':
        return this._transloco.translate(
          'refereeCourseAdmin.import.statusInReview'
        );
      case 'partially_submitted':
        return this._transloco.translate(
          'refereeCourseAdmin.import.statusPartiallySubmitted'
        );
      case 'submitted':
        return this._transloco.translate(
          'refereeCourseAdmin.import.statusSubmitted'
        );
      case 'completed':
        return this._transloco.translate(
          'refereeCourseAdmin.import.statusCompleted'
        );
      case 'cancelled':
        return this._transloco.translate(
          'refereeCourseAdmin.import.statusCancelled'
        );
      default:
        return status;
    }
  }
}
