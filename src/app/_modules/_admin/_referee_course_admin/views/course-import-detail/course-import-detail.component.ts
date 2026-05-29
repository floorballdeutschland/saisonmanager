import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import {
  NotificationService,
  RefereeCourseImportService,
  RefereeService,
} from '@floorball/core';
import {
  RefereeCourseImportWithResults,
  RefereeCourseMasterFields,
  RefereeCourseResult,
  RefereeLicenseLevel,
} from '@floorball/types';

type MasterField = keyof RefereeCourseMasterFields;

@Component({
  templateUrl: './course-import-detail.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseImportDetailComponent implements OnInit, OnDestroy {
  importData: RefereeCourseImportWithResults | null = null;
  licenseLevels: RefereeLicenseLevel[] = [];
  loading = false;
  submitting = false;

  // Per-row local edit state (debounced PATCH on blur/change)
  saving = new Set<number>();

  readonly conflictFields: MasterField[] = [
    'lizenznummer',
    'vorname',
    'nachname',
    'geburtsdatum',
    'email',
  ];

  private _destroy$ = new Subject<void>();

  constructor(
    private _route: ActivatedRoute,
    private _router: Router,
    private _service: RefereeCourseImportService,
    private _refereeService: RefereeService,
    private _notify: NotificationService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._refereeService
      .adminGetLicenseLevels()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (levels) => {
          this.licenseLevels = levels;
          this._cdr.markForCheck();
        },
        error: () => {
          this._notify.error(
            'Lizenzstufen konnten nicht geladen werden — Submit ist erst nach Reload möglich.'
          );
          this._cdr.markForCheck();
        },
      });

    this._route.params.pipe(takeUntil(this._destroy$)).subscribe((p) => {
      const id = Number(p['id']);
      if (id) this.load(id);
    });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  load(id: number): void {
    this.loading = true;
    this._service
      .getImport(id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (data) => {
          this.importData = data;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.loading = false;
          this._notify.error(
            err?.error?.error ?? 'Import konnte nicht geladen werden'
          );
          this._cdr.markForCheck();
        },
      });
  }

  // --- Master-Auswahl ----------------------------------------------------

  fieldsDiffer(result: RefereeCourseResult, field: MasterField): boolean {
    const csv = this.csvValue(result, field);
    const db = this.dbValue(result, field);
    if (csv == null || csv === '') return false;
    if (db == null || db === '') return false;
    return String(csv).toLowerCase() !== String(db).toLowerCase();
  }

  csvValue(result: RefereeCourseResult, field: MasterField): unknown {
    if (field === 'club_id') {
      return result.csv.verein ?? null;
    }
    const key = field as keyof RefereeCourseResult['csv'];
    return result.csv[key];
  }

  dbValue(result: RefereeCourseResult, field: MasterField): unknown {
    if (!result.referee_snapshot) return null;
    return (result.referee_snapshot as never)[field];
  }

  currentMaster(result: RefereeCourseResult, field: MasterField): unknown {
    return result.master_by_importer[field];
  }

  pickMaster(
    result: RefereeCourseResult,
    field: MasterField,
    source: 'csv' | 'db'
  ): void {
    // club_id ist aktuell kein Konflikt-Feld (Verein-Match erfolgt exakt-
    // namentlich beim Import). csvValue() würde hier den Vereinsnamen aus
    // dem CSV als String zurückgeben, das Backend erwartet number | null —
    // daher explizit ausschließen.
    if (field === 'club_id') return;
    const value =
      source === 'csv'
        ? this.csvValue(result, field) ?? null
        : this.dbValue(result, field) ?? null;
    this.patchMaster(result, {
      [field]: value,
    } as Partial<RefereeCourseMasterFields>);
  }

  patchMaster(
    result: RefereeCourseResult,
    patch: Partial<RefereeCourseMasterFields>
  ): void {
    // Skip wenn für diese Zeile bereits ein PATCH in flight ist — sonst
    // können Responses out-of-order kommen und ältere überschreiben neuere.
    if (this.saving.has(result.id)) return;
    this.saving.add(result.id);
    const rowLabel = this.rowLabel(result);
    this._service
      .updateResult(result.id, { master_by_importer: patch })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.replaceResult(updated);
          this.saving.delete(result.id);
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.saving.delete(result.id);
          this._notify.error(
            err?.error?.error ?? `Speichern fehlgeschlagen für ${rowLabel}`
          );
          this.load(result.referee_course_import_id);
        },
      });
  }

  updateLizenzstufe(result: RefereeCourseResult, value: string): void {
    if (result.lizenzstufe === value) return;
    if (this.saving.has(result.id)) return;
    this.saving.add(result.id);
    const rowLabel = this.rowLabel(result);
    this._service
      .updateResult(result.id, { lizenzstufe: value || null })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.replaceResult(updated);
          this.saving.delete(result.id);
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.saving.delete(result.id);
          this._notify.error(
            err?.error?.error ??
              `Lizenzstufe konnte nicht gespeichert werden für ${rowLabel}`
          );
          this.load(result.referee_course_import_id);
        },
      });
  }

  private rowLabel(result: RefereeCourseResult): string {
    const name = [
      result.master_by_importer.vorname,
      result.master_by_importer.nachname,
    ]
      .filter(Boolean)
      .join(' ');
    const liz = result.master_by_importer.lizenznummer;
    return liz ? `${name} (Liz. ${liz})` : name || `Zeile #${result.id}`;
  }

  // --- Submit ------------------------------------------------------------

  canSubmit(): boolean {
    if (!this.importData) return false;
    if (this.importData.status !== 'in_review') return false;
    // Ohne geladene Lizenzstufen kann der User die Select-Werte nicht (mehr) anpassen –
    // dann Submit blockieren, damit der Stand nicht aus alten Daten heraus eingereicht wird.
    if (this.licenseLevels.length === 0) return false;
    return this.importData.results.every((r) => !!r.lizenzstufe);
  }

  missingLicenseLevelCount(): number {
    if (!this.importData) return 0;
    return this.importData.results.filter((r) => !r.lizenzstufe).length;
  }

  submit(): void {
    if (!this.importData) return;
    this.submitting = true;
    this._service
      .submitImport(this.importData.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (data) => {
          this.importData = data;
          this.submitting = false;
          this._notify.success('Import eingereicht');
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.submitting = false;
          this._notify.error(err?.error?.error ?? 'Einreichen fehlgeschlagen');
          this._cdr.markForCheck();
        },
      });
  }

  cancel(): void {
    if (!this.importData) return;

    this._service
      .cancelImport(this.importData.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this._router.navigate(['/verwaltung/schiri-kurse']);
        },
        error: () => this._notify.error('Abbruch fehlgeschlagen'),
      });
  }

  // --- Helpers -----------------------------------------------------------

  matchBadgeLabel(result: RefereeCourseResult): string {
    switch (result.match_type) {
      case 'exact_match':
        return 'Exakter Match (6/6)';
      case 'partial_match':
        return `Teilmatch (${result.match_field_count}/6)`;
      case 'new_entry':
        return 'Neuanlage';
    }
  }

  matchBadgeClass(result: RefereeCourseResult): string {
    switch (result.match_type) {
      case 'exact_match':
        return 'bg-green-100 text-green-800';
      case 'partial_match':
        return 'bg-yellow-100 text-yellow-800';
      case 'new_entry':
        return 'bg-blue-100 text-blue-800';
    }
  }

  trackResult(_: number, result: RefereeCourseResult): number {
    return result.id;
  }

  private replaceResult(updated: RefereeCourseResult): void {
    if (!this.importData) return;
    this.importData = {
      ...this.importData,
      results: this.importData.results.map((r) =>
        r.id === updated.id ? { ...r, ...updated } : r
      ),
    };
  }
}
