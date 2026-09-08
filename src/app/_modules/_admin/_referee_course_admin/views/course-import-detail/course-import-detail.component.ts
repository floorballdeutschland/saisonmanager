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
import { TranslocoService } from '@jsverse/transloco';
import {
  ClubService,
  NotificationService,
  RefereeCourseImportService,
  RefereeService,
} from '@floorball/core';
import {
  Club,
  RefereeCourseImportWithResults,
  RefereeCourseMasterFields,
  RefereeCourseResult,
  RefereeLicenseLevel,
} from '@floorball/types';

import { clubMatchHintKey, csvClubUnmatched } from '../../club-match-hint';

type MasterField = keyof RefereeCourseMasterFields;

@Component({
  templateUrl: './course-import-detail.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class CourseImportDetailComponent implements OnInit, OnDestroy {
  importData: RefereeCourseImportWithResults | null = null;
  licenseLevels: RefereeLicenseLevel[] = [];
  clubs: Club[] = [];
  // Ohne Vereinsliste zeigt das Auswahlfeld nichts an, auch wenn ein Verein
  // gesetzt ist. Dann bleibt es gesperrt und der gesetzte Wert steht daneben —
  // sonst schriebe ein Enter im leeren Suchfeld ein `club_id: null`.
  clubsUnavailable = false;
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
    private _clubService: ClubService,
    private _notify: NotificationService,
    private _transloco: TranslocoService,
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
            this._transloco.translate(
              'refereeCourseAdmin.notifications.licenseLevelsLoadError'
            )
          );
          this._cdr.markForCheck();
        },
      });

    // `getAdminClubAll` und nicht `getAdminClubs`: Letzteres wertet nur
    // `ph[:admin]` und `ph[:sbk]` aus, ein reiner RSK bekäme 200 mit leerer
    // Liste — und ein leeres Auswahlfeld schreibt beim Enter ein `club_id: null`.
    this._clubService
      .getAdminClubAll()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (clubs) => {
          this.clubs = clubs;
          this.clubsUnavailable = clubs.length === 0;
          this._cdr.markForCheck();
        },
        error: () => {
          this.clubsUnavailable = true;
          this._notify.error(
            this._transloco.translate(
              'refereeCourseAdmin.notifications.loadClubsError'
            )
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
            err?.error?.error ??
              this._transloco.translate(
                'refereeCourseAdmin.notifications.loadImportError'
              )
          );
          this._cdr.markForCheck();
        },
      });
  }

  // --- Zurückstellen -----------------------------------------------------

  /**
   * Ein teilweise eingereichter Import ist weiter bearbeitbar — seine
   * zurückgestellten Zeilen sollen ja geklärt und nachgereicht werden.
   */
  isEditable(): boolean {
    return (
      this.importData?.status === 'in_review' ||
      this.importData?.status === 'partially_submitted'
    );
  }

  /**
   * Eine eingereichte Zeile gehört dem Landesverband, nicht mehr dem
   * Importeur. Der Zeilenstatus zählt mit: Eine verworfene Zeile
   * (`rejected`, nie eingereicht) trägt kein `submitted_at` und wäre sonst
   * weiter bedienbar — ihr Lizenzstufen-Feld sowieso, und die Konflikt-Knöpfe
   * einer eingereichten Zeile liefen in einen 403, der über den
   * ErrorInterceptor auf die Startseite führt.
   */
  isRowEditable(result: RefereeCourseResult): boolean {
    return (
      this.isEditable() &&
      !result.submitted_at &&
      result.status === 'pending_review'
    );
  }

  /** Die Zeilen, die „Einreichen" jetzt anwenden würde. */
  submittableResults(): RefereeCourseResult[] {
    if (!this.importData) return [];
    return this.importData.results.filter(
      (r) => !r.deferred && !r.submitted_at && r.status === 'pending_review'
    );
  }

  deferredCount(): number {
    if (!this.importData) return 0;
    return this.importData.results.filter(
      (r) => r.deferred && !r.submitted_at && r.status === 'pending_review'
    ).length;
  }

  isDiscarded(result: RefereeCourseResult): boolean {
    return result.status === 'rejected' && !result.submitted_at;
  }

  toggleDeferred(result: RefereeCourseResult): void {
    this.patchResult(result, { deferred: !result.deferred });
  }

  discard(result: RefereeCourseResult): void {
    // Der Aufrufer blendet den Knopf während eines laufenden PATCH aus; kommt
    // der Klick trotzdem an (Dialog war schon offen), bleibt die Meldung
    // statt eines stillen Ausstiegs — der Dialog schließt sich selbst, es sähe
    // sonst wie ein erfolgtes Verwerfen aus.
    if (this.saving.has(result.id)) {
      this._notify.error(
        this._transloco.translate(
          'refereeCourseAdmin.notifications.rowBusy',
          { row: this.rowLabel(result) }
        )
      );
      return;
    }
    this.saving.add(result.id);
    const rowLabel = this.rowLabel(result);
    this._service
      .discardResult(result.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.saving.delete(result.id);
          // Neu laden statt die Zeile zu ersetzen: Das Verwerfen der letzten
          // offenen Zeile schließt den Import ab, der Status im Kopf der Seite
          // ändert sich also mit. `markForCheck` davor, damit der Ladezustand
          // unter OnPush überhaupt gerendert wird — `load()` setzt nur das Feld.
          this._cdr.markForCheck();
          this.load(result.referee_course_import_id);
        },
        error: (err) => {
          this.saving.delete(result.id);
          this._notify.error(
            err?.error?.error ??
              this._transloco.translate(
                'refereeCourseAdmin.notifications.discardFailedForRow',
                { row: rowLabel }
              )
          );
          this._cdr.markForCheck();
        },
      });
  }

  // --- Verein ------------------------------------------------------------

  /** Siehe `csvClubUnmatched` — die Regel teilen beide Masken. */
  clubUnmatched(result: RefereeCourseResult): boolean {
    return csvClubUnmatched(result);
  }

  /**
   * Worüber der Verein zugeordnet wurde, wenn nicht exakt über den Namen.
   *
   * Nur, wenn der Hinweis den angezeigten Verein auch erklärt: `matched_club`
   * ist der beim Import gespeicherte Zielwert, `csv_club_match` wird pro
   * Anfrage neu aufgelöst. Für einen Import, der vor der besseren Auflösung
   * angelegt wurde und noch offen ist, fällt das auseinander — dann stünde
   * „über den Langnamen zugeordnet" unter einem „—" oder unter dem Verein des
   * Schiedsrichters.
   */
  clubMatchHint(result: RefereeCourseResult): string | null {
    if (result.csv_club_match && result.csv_club_match.id !== result.matched_club?.id) {
      return null;
    }
    const key = clubMatchHintKey(result);
    return key ? this._transloco.translate(key) : null;
  }

  // --- Verein setzen -----------------------------------------------------

  /**
   * Der Verein der Zeile, wie er beim Einreichen geschrieben würde. Der
   * Importeur kann ihn hier setzen: Ein nicht zugeordneter Vereinsname ist in
   * der Regel ein Tippfehler oder eine Schreibweise, die die Datenbank anders
   * führt — die Korrektur lief bisher nur über die Freigabe des
   * Landesverbands oder über eine neue Datei.
   */
  selectedClubId(result: RefereeCourseResult): number | null {
    return result.master_by_importer.club_id ?? null;
  }

  setClub(result: RefereeCourseResult, clubId: number | null): void {
    if (this.selectedClubId(result) === clubId) return;
    this.patchMaster(result, { club_id: clubId });
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
    // club_id ist kein Konflikt-Feld: csvValue() würde hier den Vereinsnamen
    // aus der Datei als String zurückgeben, das Backend erwartet
    // number | null. Der Verein hat deshalb sein eigenes Auswahlfeld
    // (setClub) statt zweier Knöpfe.
    if (field === 'club_id') return;
    const value =
      source === 'csv'
        ? (this.csvValue(result, field) ?? null)
        : (this.dbValue(result, field) ?? null);
    this.patchMaster(result, {
      [field]: value,
    } as Partial<RefereeCourseMasterFields>);
  }

  patchMaster(
    result: RefereeCourseResult,
    patch: Partial<RefereeCourseMasterFields>
  ): void {
    this.patchResult(result, { master_by_importer: patch });
  }

  private patchResult(
    result: RefereeCourseResult,
    patch: {
      deferred?: boolean;
      master_by_importer?: Partial<RefereeCourseMasterFields>;
    }
  ): void {
    // Skip wenn für diese Zeile bereits ein PATCH in flight ist — sonst
    // können Responses out-of-order kommen und ältere überschreiben neuere.
    if (this.saving.has(result.id)) return;
    this.saving.add(result.id);
    const rowLabel = this.rowLabel(result);
    this._service
      .updateResult(result.id, patch)
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
              this._transloco.translate(
                'refereeCourseAdmin.notifications.saveFailedForRow',
                { row: rowLabel }
              )
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
              this._transloco.translate(
                'refereeCourseAdmin.notifications.licenseLevelSaveFailedForRow',
                { row: rowLabel }
              )
          );
          this.load(result.referee_course_import_id);
        },
      });
  }

  // Nicht privat: Die Verwerfen-Bestätigung nennt die Zeile im Text.
  rowLabel(result: RefereeCourseResult): string {
    const name = [
      result.master_by_importer.vorname,
      result.master_by_importer.nachname,
    ]
      .filter(Boolean)
      .join(' ');
    const liz = result.master_by_importer.lizenznummer;
    if (liz) {
      return this._transloco.translate(
        'refereeCourseAdmin.notifications.rowWithLicense',
        { name, licenseNumber: liz }
      );
    }
    return (
      name ||
      this._transloco.translate(
        'refereeCourseAdmin.notifications.rowFallback',
        {
          id: result.id,
        }
      )
    );
  }

  // --- Submit ------------------------------------------------------------

  canSubmit(): boolean {
    if (!this.isEditable()) return false;
    // Siehe submit(): erst die offenen Zeilen-PATCHes, dann einreichen.
    if (this.saving.size > 0) return false;
    // Ohne geladene Lizenzstufen kann der User die Select-Werte nicht (mehr) anpassen –
    // dann Submit blockieren, damit der Stand nicht aus alten Daten heraus eingereicht wird.
    if (this.licenseLevels.length === 0) return false;
    const rows = this.submittableResults();
    // Nur die einreichbaren Zeilen: Eine zurückgestellte Zeile ohne Lizenzstufe
    // ist ja genau der Fall, den das Zurückstellen aus dem Weg räumt.
    return rows.length > 0 && rows.every((r) => !!r.lizenzstufe);
  }

  submittableCount(): number {
    return this.submittableResults().length;
  }

  /**
   * Bezugsgröße für „X von Y einreichen": nur die Zeilen, die noch zur Debatte
   * stehen. Die Gesamtzahl der Zeilen läse sich im teilweise eingereichten
   * Import als „der Rest bleibt liegen", während er längst durch ist.
   */
  pendingCount(): number {
    return this.submittableCount() + this.deferredCount();
  }

  /** Eine vom Landesverband zurückgewiesene Zeile — nicht vom Importeur verworfen. */
  isRejectedByLv(result: RefereeCourseResult): boolean {
    return result.status === 'rejected' && !!result.submitted_at;
  }

  missingLicenseLevelCount(): number {
    return this.submittableResults().filter((r) => !r.lizenzstufe).length;
  }

  submit(): void {
    if (!this.importData) return;
    // Kein Submit, während für eine Zeile noch ein PATCH läuft: Wer eine Zeile
    // zurückstellt und sofort einreicht, könnte sie sonst doch angewendet
    // bekommen — der Server liest den Stand vor dem Commit des PATCH, und für
    // eine angewendete Lizenz gibt es keine Rücknahme.
    if (this.submitting || this.saving.size > 0) return;
    this.submitting = true;
    this._service
      .submitImport(this.importData.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (data) => {
          this.submitting = false;
          this._notify.success(
            this._transloco.translate(
              data.status === 'partially_submitted'
                ? 'refereeCourseAdmin.notifications.partiallySubmitted'
                : 'refereeCourseAdmin.notifications.submitted'
            )
          );
          // Die Submit-Antwort trägt den Import ohne seine Zeilen. Direkt
          // zugewiesen stand die Tabelle ohne `results` da.
          this.load(data.id);
        },
        error: (err) => {
          this.submitting = false;
          this._notify.error(
            err?.error?.error ??
              this._transloco.translate(
                'refereeCourseAdmin.notifications.submitFailed'
              )
          );
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
        error: () =>
          this._notify.error(
            this._transloco.translate(
              'refereeCourseAdmin.notifications.cancelFailed'
            )
          ),
      });
  }

  // --- Helpers -----------------------------------------------------------

  matchBadgeLabel(result: RefereeCourseResult): string {
    switch (result.match_type) {
      case 'exact_match':
        return this._transloco.translate(
          'refereeCourseAdmin.detail.badgeExact'
        );
      case 'partial_match':
        return this._transloco.translate(
          'refereeCourseAdmin.detail.badgePartial',
          { count: result.match_field_count }
        );
      case 'new_entry':
        return this._transloco.translate('refereeCourseAdmin.detail.badgeNew');
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
