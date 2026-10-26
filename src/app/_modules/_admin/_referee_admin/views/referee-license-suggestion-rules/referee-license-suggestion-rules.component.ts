import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { forkJoin, Subject, takeUntil } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { NotificationService, RefereeService } from '@floorball/core';
import {
  RefereeLicenseLevel,
  RefereeLicenseSuggestionFieldSize,
  RefereeLicenseSuggestionRule,
} from '@floorball/types';

/**
 * Regeln für den Lizenzvorschlag bei Kursen im System (api#861). Steht in
 * den Schiri-Einstellungen (nur Admin). Der Vorschlag erscheint in der
 * Lizenzvergabe; die Stufe setzt FD dort weiterhin selbst.
 */
@Component({
  selector: 'fb-referee-license-suggestion-rules',
  templateUrl: './referee-license-suggestion-rules.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class RefereeLicenseSuggestionRulesComponent
  implements OnInit, OnDestroy
{
  rules: RefereeLicenseSuggestionRule[] = [];
  courseTypes: string[] = [];
  fieldSizes: RefereeLicenseSuggestionFieldSize[] = [];
  ageGroups: string[] = [];
  levels: RefereeLicenseLevel[] = [];
  loading = false;
  busy = false;

  private _destroy$ = new Subject<void>();

  constructor(
    private _service: RefereeService,
    private _notify: NotificationService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loading = true;
    forkJoin({
      rules: this._service.adminGetLicenseSuggestionRules(),
      levels: this._service.adminGetLicenseLevels(),
    })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: ({ rules, levels }) => {
          this.rules = rules.rules;
          this.courseTypes = rules.course_types;
          this.fieldSizes = rules.field_sizes;
          this.ageGroups = rules.age_groups;
          this.levels = levels.filter((l) => l.active);
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

  add(): void {
    const last = this.rules[this.rules.length - 1];
    this.rules = [
      ...this.rules,
      {
        course_type: last?.course_type ?? 'f',
        referee_license_level_id: null,
        position: (last?.position ?? -1) + 1,
        min_games: null,
        field_size: 'all',
        age_groups: [],
      },
    ];
  }

  hasAgeGroup(rule: RefereeLicenseSuggestionRule, ageGroup: string): boolean {
    return rule.age_groups.includes(ageGroup);
  }

  toggleAgeGroup(
    rule: RefereeLicenseSuggestionRule,
    ageGroup: string,
    checked: boolean
  ): void {
    rule.age_groups = checked
      ? [...rule.age_groups, ageGroup]
      : rule.age_groups.filter((a) => a !== ageGroup);
  }

  save(rule: RefereeLicenseSuggestionRule): void {
    this.busy = true;
    this._service
      .adminSaveLicenseSuggestionRule(rule)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (saved) => {
          this.rules = this.rules.map((r) => (r === rule ? saved : r));
          this.busy = false;
          this._notify.success(
            this._transloco.translate('refereeAdmin.suggestionRules.saved')
          );
          this._cdr.markForCheck();
        },
        // Die Fehlermeldung (422) zeigt der ErrorInterceptor selbst an.
        error: () => {
          this.busy = false;
          this._cdr.markForCheck();
        },
      });
  }

  remove(rule: RefereeLicenseSuggestionRule): void {
    if (!rule.id) {
      this.rules = this.rules.filter((r) => r !== rule);
      return;
    }
    this.busy = true;
    this._service
      .adminDeleteLicenseSuggestionRule(rule.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.rules = this.rules.filter((r) => r !== rule);
          this.busy = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.busy = false;
          this._cdr.markForCheck();
        },
      });
  }
}
