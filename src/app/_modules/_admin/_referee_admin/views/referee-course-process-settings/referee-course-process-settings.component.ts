import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { forkJoin, Subject, takeUntil } from 'rxjs';
import {
  NotificationService,
  RefereeCourseImportService,
  StateAssociationService,
} from '@floorball/core';
import {
  RefereeCourseProcessSettings,
  StateAssociation,
} from '@floorball/types';
import { TranslocoService } from '@jsverse/transloco';

/**
 * Schalter für die beiden Wege, auf denen Kursergebnisse ins System kommen:
 * CSV-Import und Kurse im System. Steht in den Schiri-Einstellungen (nur
 * Admin). Die API sperrt sofort; die Menüpunkte hängen an den Rechten im
 * Benutzerkonto und ändern sich erst nach einer Neuanmeldung.
 */
@Component({
  selector: 'fb-referee-course-process-settings',
  templateUrl: './referee-course-process-settings.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class RefereeCourseProcessSettingsComponent
  implements OnInit, OnDestroy
{
  settings: RefereeCourseProcessSettings | null = null;
  draft: RefereeCourseProcessSettings | null = null;
  stateAssociations: StateAssociation[] = [];
  loading = false;
  saving = false;

  private _destroy$ = new Subject<void>();

  constructor(
    private _service: RefereeCourseImportService,
    private _stateAssociationService: StateAssociationService,
    private _notify: NotificationService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loading = true;
    forkJoin({
      settings: this._service.getProcessSettings(),
      stateAssociations: this._stateAssociationService.adminGetAll(),
    })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: ({ settings, stateAssociations }) => {
          this.stateAssociations = [...stateAssociations].sort((a, b) =>
            a.name.localeCompare(b.name, 'de')
          );
          this.apply(settings);
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  get dirty(): boolean {
    if (!this.settings || !this.draft) return false;
    return (
      this.settings.csv_import_enabled !== this.draft.csv_import_enabled ||
      this.settings.courses_enabled !== this.draft.courses_enabled ||
      this.settings.courses_state_association_ids.join(',') !==
        this.draft.courses_state_association_ids.join(',')
    );
  }

  /** Beide aus: Dann führt kein Weg mehr von einem Kurs zu einer Lizenz. */
  get bothOff(): boolean {
    return (
      !!this.draft &&
      !this.draft.csv_import_enabled &&
      !this.draft.courses_enabled
    );
  }

  isSelected(id: number): boolean {
    return !!this.draft?.courses_state_association_ids.includes(id);
  }

  toggleStateAssociation(id: number, checked: boolean): void {
    if (!this.draft) return;
    const ids = this.draft.courses_state_association_ids.filter(
      (x) => x !== id
    );
    if (checked) ids.push(id);
    this.draft = {
      ...this.draft,
      courses_state_association_ids: ids.sort((a, b) => a - b),
    };
  }

  reset(): void {
    if (this.settings) this.apply(this.settings);
  }

  save(): void {
    if (!this.draft || this.saving) return;
    this.saving = true;
    this._service
      .updateProcessSettings({
        csv_import_enabled: this.draft.csv_import_enabled,
        courses_enabled: this.draft.courses_enabled,
        courses_state_association_ids: this.draft.courses_state_association_ids,
      })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (settings) => {
          this.apply(settings);
          this.saving = false;
          this._notify.success(
            this._transloco.translate('refereeAdmin.courseProcesses.saved')
          );
          this._cdr.markForCheck();
        },
        // Die Meldung zeigt der ErrorInterceptor.
        error: () => {
          this.saving = false;
          this._cdr.markForCheck();
        },
      });
  }

  // Sortiert ablegen: `dirty` vergleicht die Listen in Reihenfolge, und
  // toggleStateAssociation sortiert den Entwurf.
  private apply(settings: RefereeCourseProcessSettings): void {
    const ids = [...settings.courses_state_association_ids].sort(
      (a, b) => a - b
    );
    this.settings = { ...settings, courses_state_association_ids: ids };
    this.draft = { ...settings, courses_state_association_ids: [...ids] };
  }
}
