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

  private _destroy$ = new Subject<void>();

  constructor(
    private _service: RefereeCourseImportService,
    private _notify: NotificationService,
    private _router: Router,
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
            err?.error?.error ?? 'Liste der Imports konnte nicht geladen werden'
          );
          this._cdr.markForCheck();
        },
      });
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
      return 'Bitte eine CSV-Datei auswählen (.csv).';
    }
    if (file.size > CourseImportIndexComponent.MAX_FILE_SIZE_BYTES) {
      return 'Datei ist zu groß (max. 5 MB).';
    }
    if (file.size === 0) {
      return 'Datei ist leer.';
    }
    return null;
  }

  private errorMessageForStatus(status: number | undefined): string {
    switch (status) {
      case 0:
        return 'Keine Verbindung zum Server.';
      case 413:
        return 'Datei ist zu groß.';
      case 415:
        return 'Dateiformat wird nicht unterstützt.';
      case 422:
        return 'CSV-Inhalt konnte nicht verarbeitet werden.';
      default:
        return 'Upload fehlgeschlagen.';
    }
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'in_review':
        return 'In Bearbeitung';
      case 'submitted':
        return 'Eingereicht';
      case 'completed':
        return 'Abgeschlossen';
      case 'cancelled':
        return 'Abgebrochen';
      default:
        return status;
    }
  }
}
