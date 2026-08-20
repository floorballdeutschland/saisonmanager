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
import { NotificationService, RefereeService } from '@floorball/core';
import {
  RefereeBulkUserResult,
  RefereeEmailImportReport,
  RefereeMissingUserCount,
} from '@floorball/types';

// E-Mail-Import aus einer CSV und Massenanlage der Schiedsrichter-Konten. Beides
// ist der Verwaltung vorbehalten (referee_account_tools) und liegt auf einer
// Seite, weil es dieselbe Kette ist: Ohne Adresse kein Konto.
@Component({
  templateUrl: './referee-accounts.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class RefereeAccountsComponent implements OnInit, OnDestroy {
  // Gleiche Grenze wie die API (MAX_CSV_BYTES). Vorab geprüft, damit eine zu
  // große Datei nicht erst hochgeladen und dann abgewiesen wird.
  static readonly MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

  importing = false;
  report: RefereeEmailImportReport | null = null;

  countLoading = false;
  missing: RefereeMissingUserCount | null = null;
  creating = false;
  bulkResult: RefereeBulkUserResult | null = null;

  private _destroy$ = new Subject<void>();

  constructor(
    private _refereeService: RefereeService,
    private _notify: NotificationService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadCount();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  loadCount(): void {
    this.countLoading = true;
    this._refereeService
      .adminGetMissingUserCount()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.missing = result;
          this.countLoading = false;
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.countLoading = false;
          this._notify.error(
            err?.error?.error ??
              this._transloco.translate('refereeAdmin.accounts.countError')
          );
          this._cdr.markForCheck();
        },
      });
  }

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

    this.importing = true;
    this.report = null;
    this._refereeService
      .adminImportEmails(file)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (report) => {
          this.importing = false;
          input.value = '';
          this.report = report;
          this._notify.success(
            this._transloco.translate('refereeAdmin.accounts.importDone', {
              count: report.updated.length,
            })
          );
          // Neu eingetragene Adressen sind neue Kandidaten für die Massenanlage.
          this.loadCount();
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.importing = false;
          input.value = '';
          this._notify.error(
            err?.error?.error ??
              this._transloco.translate('refereeAdmin.accounts.importError')
          );
          this._cdr.markForCheck();
        },
      });
  }

  createMissingUsers(): void {
    this.creating = true;
    this.bulkResult = null;
    this._refereeService
      .adminCreateMissingUsers()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.creating = false;
          this.bulkResult = result;
          this._notify.success(
            this._transloco.translate('refereeAdmin.accounts.createDone', {
              count: result.created.length,
            })
          );
          this.loadCount();
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.creating = false;
          this._notify.error(
            err?.error?.error ??
              this._transloco.translate('refereeAdmin.accounts.createError')
          );
          this._cdr.markForCheck();
        },
      });
  }

  // Wie viele Konten der nächste Klick anlegt: der Rest, aber höchstens eine
  // Tranche. Ohne diese Angabe stünde bei 800 offenen Konten ein Knopf, der
  // aussieht, als legte er alle 800 auf einmal an.
  nextBatchSize(): number {
    if (!this.missing) return 0;
    return Math.min(this.missing.count, this.missing.batch_size);
  }

  skippedReason(reason: string | undefined): string {
    return this._transloco.translate(
      reason === 'identical'
        ? 'refereeAdmin.accounts.reasonIdentical'
        : 'refereeAdmin.accounts.reasonOtherEmail'
    );
  }

  private validateFile(file: File): string | null {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return this._transloco.translate('refereeAdmin.accounts.fileNotCsv');
    }
    if (file.size > RefereeAccountsComponent.MAX_FILE_SIZE_BYTES) {
      return this._transloco.translate('refereeAdmin.accounts.fileTooLarge');
    }
    if (file.size === 0) {
      return this._transloco.translate('refereeAdmin.accounts.fileEmpty');
    }
    return null;
  }
}
