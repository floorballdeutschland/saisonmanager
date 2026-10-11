import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Observable, Subject, takeUntil } from 'rxjs';
import { NotificationService, RefereeCourseService } from '@floorball/core';
import { CourseLicensingRow } from '@floorball/types';
import { TranslocoService } from '@jsverse/transloco';

interface CourseGroup {
  id: number;
  title: string;
  stateAssociation: string | null;
  endsOn: string | null;
  levels: string[];
  rows: CourseLicensingRow[];
}

/**
 * Lizenzvergabe durch FD für Kurse im System. Die Lizenz legt immer FD fest:
 * je bestandener Teilnahme Zuordnung prüfen, Stufe wählen, erteilen oder mit
 * Begründung ablehnen. Die angestrebte Stufe der Person ist nur ein Hinweis.
 */
@Component({
  templateUrl: './course-licensing.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class CourseLicensingComponent implements OnInit, OnDestroy {
  status: 'pending' | 'done' = 'pending';
  rows: CourseLicensingRow[] = [];
  levels: string[] = [];
  loading = true;
  busy = false;
  selected = new Set<number>();

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
        this.levels = options.license_levels.map((l) => l.name);
        this._cdr.markForCheck();
      });
    this.load();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  setStatus(status: 'pending' | 'done'): void {
    this.status = status;
    this.selected.clear();
    this.load();
  }

  load(): void {
    this.loading = true;
    this._service
      .licensing(this.status)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (rows) => {
          this.rows = rows;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }

  get groups(): CourseGroup[] {
    const groups = new Map<number, CourseGroup>();
    for (const row of this.rows) {
      let group = groups.get(row.course.id);
      if (!group) {
        group = {
          id: row.course.id,
          title: row.course.title,
          stateAssociation: row.course.state_association,
          endsOn: row.course.ends_on,
          levels: row.course.license_levels,
          rows: [],
        };
        groups.set(row.course.id, group);
      }
      group.rows.push(row);
    }
    return [...groups.values()];
  }

  /** Bereit für die Sammelfreigabe: Stufe gewählt. */
  ready(row: CourseLicensingRow): boolean {
    return row.status === 'pending_review' && !!row.lizenzstufe;
  }

  toggle(row: CourseLicensingRow, on: boolean): void {
    if (on) this.selected.add(row.id);
    else this.selected.delete(row.id);
  }

  get selectedReady(): number[] {
    return this.rows
      .filter((r) => this.selected.has(r.id) && this.ready(r))
      .map((r) => r.id);
  }

  setLevel(row: CourseLicensingRow, level: string | null): void {
    this.run(
      this._service.licensingUpdate(row.id, { lizenzstufe: level }),
      (u) => this.replace(u)
    );
  }

  assign(row: CourseLicensingRow, refereeId: number | null): void {
    this.run(
      this._service.licensingUpdate(row.id, { referee_id: refereeId }),
      (u) => this.replace(u)
    );
  }

  approve(row: CourseLicensingRow): void {
    this.run(this._service.licensingApprove(row.id), (u) => {
      this.replace(u);
      this.selected.delete(row.id);
      if (u.account === 'created') {
        this._notify.success(
          this._transloco.translate(
            'refereeCourseAdmin.licensing.accountCreated',
            {
              name: `${u.person.vorname} ${u.person.nachname}`,
            }
          )
        );
      }
    });
  }

  approveSelected(): void {
    const ids = this.selectedReady;
    if (!ids.length) return;
    this.run(this._service.licensingApproveMany(ids), (res) => {
      const failed = res.results.filter((r) => r.error);
      if (failed.length) {
        this._notify.error(
          failed.map((f) => `#${f.id}: ${f.error}`).join(' · ')
        );
      } else {
        this._notify.success(
          this._transloco.translate(
            'refereeCourseAdmin.licensing.approvedMany',
            {
              count: ids.length,
            }
          )
        );
      }
      this.selected.clear();
      this.load();
    });
  }

  reject(row: CourseLicensingRow): void {
    const reason = prompt(
      this._transloco.translate('refereeCourseAdmin.licensing.rejectPrompt', {
        name: `${row.person.vorname} ${row.person.nachname}`,
      })
    );
    if (!reason || !reason.trim()) return;
    this.run(this._service.licensingReject(row.id, reason.trim()), (u) =>
      this.replace(u)
    );
  }

  private replace(updated: CourseLicensingRow): void {
    this.rows = this.rows.map((r) => (r.id === updated.id ? updated : r));
  }

  private run<T>(request: Observable<T>, done: (value: T) => void): void {
    this.busy = true;
    request.pipe(takeUntil(this._destroy$)).subscribe({
      next: (value) => {
        this.busy = false;
        done(value);
        this._cdr.markForCheck();
      },
      // Die Meldung zeigt der ErrorInterceptor.
      error: () => {
        this.busy = false;
        this._cdr.markForCheck();
      },
    });
  }
}
