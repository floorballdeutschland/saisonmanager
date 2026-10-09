import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import {
  debounceTime,
  distinctUntilChanged,
  Observable,
  of,
  Subject,
  switchMap,
  takeUntil,
} from 'rxjs';
import {
  NotificationService,
  RefereeCourseService,
  RefereeService,
} from '@floorball/core';
import {
  RefereeAdmin,
  RefereeCourseLeadEntry,
  RefereeCourseLeadInput,
} from '@floorball/types';
import { TranslocoService } from '@jsverse/transloco';

/**
 * Kursleitungen eines Kurses zuordnen: Schiri aus dem Bestand, vorhandenes
 * Konto über den Benutzernamen oder neue Person mit Einladung. Meldet jede
 * Änderung über `changed`, die Eltern laden den Kurs dann neu.
 */
@Component({
  selector: 'fb-course-leads',
  templateUrl: './course-leads.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class CourseLeadsComponent implements OnInit, OnDestroy {
  @Input({ required: true }) courseId!: number;
  @Input() leads: RefereeCourseLeadEntry[] = [];
  @Input() editable = true;
  @Output() changed = new EventEmitter<void>();

  mode: 'referee' | 'account' | 'new' | null = null;
  busy = false;
  query = '';
  results: RefereeAdmin[] = [];
  userName = '';
  firstName = '';
  lastName = '';
  email = '';

  private _search$ = new Subject<string>();
  private _destroy$ = new Subject<void>();

  constructor(
    private _service: RefereeCourseService,
    private _refereeService: RefereeService,
    private _notify: NotificationService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._search$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) =>
          q.trim().length < 2 ? of([]) : this._refereeService.adminGetAll({ q })
        ),
        takeUntil(this._destroy$)
      )
      .subscribe({
        next: (results) => {
          this.results = results.slice(0, 10);
          this._cdr.markForCheck();
        },
        error: () => {
          this.results = [];
          this._cdr.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  open(mode: 'referee' | 'account' | 'new'): void {
    this.mode = mode;
    this.query = '';
    this.results = [];
    this.userName = '';
    this.firstName = '';
    this.lastName = '';
    this.email = '';
  }

  search(q: string): void {
    this.query = q;
    this._search$.next(q);
  }

  get newValid(): boolean {
    return (
      !!this.firstName.trim() &&
      !!this.lastName.trim() &&
      /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(this.email.trim())
    );
  }

  addReferee(referee: RefereeAdmin): void {
    this.add({ referee_id: referee.id });
  }

  addAccount(): void {
    if (!this.userName.trim()) return;
    this.add({ user_name: this.userName.trim() });
  }

  addNew(): void {
    if (!this.newValid) return;
    this.add({
      first_name: this.firstName.trim(),
      last_name: this.lastName.trim(),
      email: this.email.trim(),
    });
  }

  toggleMain(lead: RefereeCourseLeadEntry): void {
    this.run(this._service.setMainLead(this.courseId, lead.id, !lead.lead));
  }

  remove(lead: RefereeCourseLeadEntry): void {
    if (
      !confirm(
        this._transloco.translate('refereeCourseAdmin.leads.confirmRemove', {
          name: lead.name,
        })
      )
    )
      return;
    this.run(this._service.removeLead(this.courseId, lead.id));
  }

  private add(input: RefereeCourseLeadInput): void {
    this.run(this._service.addLead(this.courseId, input), (lead) => {
      this.mode = null;
      if (lead?.invited) {
        this._notify.success(
          this._transloco.translate('refereeCourseAdmin.leads.invited', {
            user: lead.user_name,
          })
        );
      }
    });
  }

  private run<T>(request: Observable<T>, done?: (value: T) => void): void {
    this.busy = true;
    request.pipe(takeUntil(this._destroy$)).subscribe({
      next: (value) => {
        this.busy = false;
        done?.(value);
        this.changed.emit();
        this._cdr.markForCheck();
      },
      error: () => {
        this.busy = false;
        this._cdr.markForCheck();
      },
    });
  }
}
