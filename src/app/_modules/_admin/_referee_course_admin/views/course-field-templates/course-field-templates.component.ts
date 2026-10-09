import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Observable, Subject, takeUntil } from 'rxjs';
import { RefereeCourseService } from '@floorball/core';
import { RefereeCourseField, RefereeCourseOptions } from '@floorball/types';
import { CourseFieldChange } from '../../components/course-field-editor/course-field-editor.component';

/**
 * Feldvorlagen je Landesverband. Ein neuer Kurs übernimmt die Vorlagen seines
 * LV; bereits angelegte Kurse bleiben unberührt.
 */
@Component({
  templateUrl: './course-field-templates.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class CourseFieldTemplatesComponent implements OnInit, OnDestroy {
  options: RefereeCourseOptions | null = null;
  /** null = Vorlagen für bundesweite Kurse. */
  stateAssociationId: number | null = null;
  templates: RefereeCourseField[] = [];
  loading = false;
  busy = false;

  private _destroy$ = new Subject<void>();

  constructor(
    private _service: RefereeCourseService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._service
      .options()
      .pipe(takeUntil(this._destroy$))
      .subscribe((options) => {
        this.options = options;
        this.stateAssociationId = options.state_associations[0]?.id ?? null;
        this.load();
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  select(id: number | null): void {
    this.stateAssociationId = id;
    this.load();
  }

  load(): void {
    this.loading = true;
    this._cdr.markForCheck();
    const requested = this.stateAssociationId;
    this._service
      .listTemplates(requested)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (templates) => {
          // Eine langsame Antwort für den vorher gewählten LV verwerfen.
          if (requested !== this.stateAssociationId) return;
          this.templates = templates;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.templates = [];
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }

  create(field: RefereeCourseField): void {
    this.run(this._service.createTemplate(this.stateAssociationId, field));
  }

  update(change: CourseFieldChange): void {
    this.run(this._service.updateTemplate(change.id, change.changes));
  }

  remove(field: RefereeCourseField): void {
    if (field.id === undefined) return;
    this.run(this._service.deleteTemplate(field.id));
  }

  private run(request: Observable<unknown>): void {
    this.busy = true;
    request.pipe(takeUntil(this._destroy$)).subscribe({
      next: () => {
        this.busy = false;
        this.load();
      },
      error: () => {
        this.busy = false;
        this._cdr.markForCheck();
      },
    });
  }
}
