import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { NotificationService, RefereeCourseService } from '@floorball/core';
import {
  CourseBillingExport,
  CourseBillingPreview,
  CourseBillingQuery,
  RefereeCourseOptions,
} from '@floorball/types';
import { TranslocoService } from '@jsverse/transloco';
import { downloadBlob } from 'src/app/_helpers/_utils/result-tile';
import { centsToEuro } from '../../course-format';

/**
 * Rechnungsexport der Kurse je Landesverband: Vorschau mit Warnungen, CSV
 * erzeugen (markiert die Zeilen als abgerechnet), frühere Exporte erneut
 * herunterladen.
 */
@Component({
  templateUrl: './course-billing.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class CourseBillingComponent implements OnInit, OnDestroy {
  options: RefereeCourseOptions | null = null;
  stateAssociationId: number | 'national' | null = null;
  from = '';
  to = '';
  includeBilled = false;

  preview: CourseBillingPreview | null = null;
  /** Die Auswahl, zu der die angezeigte Vorschau gehört. */
  previewQuery: CourseBillingQuery | null = null;
  private _previewSeq = 0;
  exports: CourseBillingExport[] = [];
  busy = false;

  readonly centsToEuro = centsToEuro;

  private _destroy$ = new Subject<void>();

  constructor(
    private _service: RefereeCourseService,
    private _notify: NotificationService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._service
      .options()
      .pipe(takeUntil(this._destroy$))
      .subscribe((options) => {
        this.options = options;
        this.stateAssociationId =
          options.state_associations[0]?.id ??
          (options.national_allowed ? 'national' : null);
        this._cdr.markForCheck();
        this.loadPreview();
      });
    this.loadExports();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  get query(): CourseBillingQuery | null {
    if (this.stateAssociationId === null) return null;
    return {
      state_association_id: this.stateAssociationId,
      from: this.from || null,
      to: this.to || null,
      include_billed: this.includeBilled,
    };
  }

  get warningCount(): number {
    return (this.preview?.rows ?? []).filter((r) => r.warnings.length).length;
  }

  /** Vorschau passt noch zur aktuellen Auswahl? Erst dann darf exportiert werden. */
  get previewCurrent(): boolean {
    return (
      !!this.previewQuery &&
      JSON.stringify(this.previewQuery) === JSON.stringify(this.query)
    );
  }

  loadPreview(): void {
    const query = this.query;
    if (!query) return;
    // Nur die Antwort auf die letzte Anfrage zählt: Bei schnellem Umschalten
    // überholt sonst eine langsame Antwort die neue Auswahl.
    const seq = ++this._previewSeq;
    this.busy = true;
    this._service
      .billingPreview(query)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (preview) => {
          if (seq !== this._previewSeq) return;
          this.preview = preview;
          this.previewQuery = query;
          this.busy = false;
          this._cdr.markForCheck();
        },
        error: () => {
          if (seq !== this._previewSeq) return;
          this.busy = false;
          this._cdr.markForCheck();
        },
      });
  }

  loadExports(): void {
    this._service
      .billingExports()
      .pipe(takeUntil(this._destroy$))
      .subscribe((exports) => {
        this.exports = exports;
        this._cdr.markForCheck();
      });
  }

  createExport(): void {
    // Exportiert wird genau die Auswahl, die die Vorschau zeigt.
    const query = this.previewQuery;
    if (!query || !this.previewCurrent || !this.preview?.row_count) return;
    if (
      !confirm(
        this._transloco.translate('refereeCourseAdmin.billing.confirm', {
          count: this.preview.row_count,
        })
      )
    )
      return;
    this.busy = true;
    this._service
      .billingCreate(query)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (created) => {
          this.busy = false;
          this.download(created);
          this.loadExports();
          this.loadPreview();
        },
        error: () => {
          this.busy = false;
          this._cdr.markForCheck();
        },
      });
  }

  download(entry: CourseBillingExport): void {
    this._service
      .billingDownload(entry.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe((blob) => {
        const lv = entry.state_association?.name ?? 'FD';
        downloadBlob(
          blob,
          `schiri-kurse-abrechnung-${lv.replace(/\s+/g, '-')}-${entry.id}.csv`
        );
      });
  }
}
