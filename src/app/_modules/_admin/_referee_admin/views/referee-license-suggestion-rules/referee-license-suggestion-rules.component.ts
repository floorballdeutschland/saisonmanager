import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
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
  // Nach Speichern und Löschen: die Seite hält die Regeln je Stufe.
  @Output() rulesChange = new EventEmitter<RefereeLicenseSuggestionRule[]>();

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

  /**
   * Eine Regel mit Mindestzahl braucht mindestens eine Altersklasse, sonst
   * zählt kein Spiel (Entscheidung 26.10.2026, die API antwortet sonst 422).
   * Die Rückfallregel ohne Mindestzahl zeigt keine Auswahl.
   */
  missingAgeGroups(rule: RefereeLicenseSuggestionRule): boolean {
    return rule.min_games != null && rule.age_groups.length === 0;
  }

  // Die letzte angehakte Altersklasse lässt sich nicht abwählen.
  isLastAgeGroup(
    rule: RefereeLicenseSuggestionRule,
    ageGroup: string
  ): boolean {
    return rule.age_groups.length === 1 && rule.age_groups[0] === ageGroup;
  }

  toggleAgeGroup(
    rule: RefereeLicenseSuggestionRule,
    ageGroup: string,
    checked: boolean
  ): void {
    if (!checked && this.isLastAgeGroup(rule, ageGroup)) return;
    rule.age_groups = checked
      ? [...rule.age_groups, ageGroup]
      : rule.age_groups.filter((a) => a !== ageGroup);
  }

  save(rule: RefereeLicenseSuggestionRule): void {
    if (this.missingAgeGroups(rule)) return;
    this.busy = true;
    this._service
      .adminSaveLicenseSuggestionRule(rule)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (saved) => {
          this.rules = this.rules.map((r) => (r === rule ? saved : r));
          this.rulesChange.emit(this.rules);
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
          this.rulesChange.emit(this.rules);
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
