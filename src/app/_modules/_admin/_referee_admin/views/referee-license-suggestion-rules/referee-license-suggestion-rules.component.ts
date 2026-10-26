import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnDestroy,
  ViewEncapsulation,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { NotificationService, RefereeService } from '@floorball/core';
import {
  RefereeLicenseSuggestionRule,
  RefereeLicenseSuggestionRulesResponse,
} from '@floorball/types';

type RuleOptions = Omit<RefereeLicenseSuggestionRulesResponse, 'rules'>;

/**
 * Wann diese Lizenzstufe nach einem Kurs vorgeschlagen wird (api#861). Steht
 * unter jeder Stufe in der Maske der Lizenzstufen, nur für Admin. Der
 * Vorschlag erscheint in der Lizenzvergabe; die Stufe setzt FD dort weiterhin
 * selbst. Eine Reihenfolge der Regeln gibt es nicht, die ergibt die API aus
 * der Mindestzahl (siehe RefereeLicenseSuggestion).
 */
@Component({
  selector: 'fb-referee-license-suggestion-rules',
  templateUrl: './referee-license-suggestion-rules.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class RefereeLicenseSuggestionRulesComponent implements OnDestroy {
  @Input({ required: true }) levelId!: number;
  @Input({ required: true }) options!: RuleOptions;
  @Input() rules: RefereeLicenseSuggestionRule[] = [];

  editing = new Set<RefereeLicenseSuggestionRule>();
  busy = false;

  private _destroy$ = new Subject<void>();

  constructor(
    private _service: RefereeService,
    private _notify: NotificationService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  add(): void {
    const rule: RefereeLicenseSuggestionRule = {
      course_type: this.options.course_types[0] ?? 'f',
      referee_license_level_id: this.levelId,
      min_games: null,
      field_size: 'all',
      age_groups: [],
    };
    this.rules = [...this.rules, rule];
    this.editing.add(rule);
  }

  edit(rule: RefereeLicenseSuggestionRule): void {
    this.editing.add(rule);
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
          this.editing.delete(rule);
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
      this.editing.delete(rule);
      return;
    }
    this.busy = true;
    this._service
      .adminDeleteLicenseSuggestionRule(rule.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.rules = this.rules.filter((r) => r !== rule);
          this.editing.delete(rule);
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
