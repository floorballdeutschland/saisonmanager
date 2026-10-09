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
import { RefereeCourseSignupService } from '@floorball/core';
import { RefereeCourseOffer } from '@floorball/types';

/**
 * Öffentliche Kursliste (/schiri-kurse). Die Filter stehen in der Adresse
 * (?verband=, ?format=, ?typ=), damit Verbandsseiten direkt verlinken können.
 */
@Component({
  templateUrl: './public-course-list.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class PublicCourseListComponent implements OnInit, OnDestroy {
  courses: RefereeCourseOffer[] = [];
  stateAssociations: { id: number; name: string }[] = [];
  enabled = true;
  loading = true;

  stateAssociationId: number | null = null;
  courseFormat: string | null = null;
  courseType: string | null = null;

  readonly formats = ['in_person', 'online', 'hybrid'];
  readonly types = [
    'j',
    'g',
    'f',
    'combined',
    'module',
    'refresher',
    'n',
    'a',
    'retest',
    'other',
  ];

  private _destroy$ = new Subject<void>();

  constructor(
    private _service: RefereeCourseSignupService,
    private _route: ActivatedRoute,
    private _router: Router,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._route.queryParamMap.pipe(takeUntil(this._destroy$)).subscribe((q) => {
      const verband = Number(q.get('verband'));
      this.stateAssociationId = verband > 0 ? verband : null;
      this.courseFormat = q.get('format');
      this.courseType = q.get('typ');
      this.load();
    });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  load(): void {
    this.loading = true;
    this._service
      .publicCourses({
        state_association_id: this.stateAssociationId,
        course_format: this.courseFormat,
        course_type: this.courseType,
      })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (res) => {
          this.enabled = res.enabled;
          this.courses = res.courses;
          // Die LV-Auswahl nur einmal füllen: gefiltert enthält die Antwort
          // sonst nur noch den gewählten Verband.
          if (this.stateAssociations.length === 0)
            this.stateAssociations = res.state_associations;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }

  setFilter(key: 'verband' | 'format' | 'typ', value: string | number | null) {
    this._router.navigate([], {
      relativeTo: this._route,
      queryParams: { [key]: value || null },
      queryParamsHandling: 'merge',
    });
  }
}
