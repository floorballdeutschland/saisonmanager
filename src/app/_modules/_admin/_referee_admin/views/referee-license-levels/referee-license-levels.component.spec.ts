import { Component, Input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import {
  getTranslocoTestingModule,
  NotificationService,
  RefereeService,
  SessionService,
} from '@floorball/core';
import { RefereeLicenseSuggestionRule } from '@floorball/types';
import { RefereeLicenseLevelsComponent } from './referee-license-levels.component';
import { RefereeLicenseSuggestionRulesComponent } from '../referee-license-suggestion-rules/referee-license-suggestion-rules.component';

@Component({
  selector: 'fb-referee-license-suggestion-rules',
  template: '',
  standalone: false,
})
class RulesStubComponent {
  @Input() levelId!: number;
  @Input() options: unknown;
  @Input() rules: RefereeLicenseSuggestionRule[] = [];
}

describe('RefereeLicenseLevelsComponent', () => {
  function render(admin: boolean) {
    const service = jasmine.createSpyObj('RefereeService', [
      'adminGetLicenseLevels',
      'adminGetLicenseSuggestionRules',
    ]);
    service.adminGetLicenseLevels.and.returnValue(
      of([
        { id: 5, name: 'L1', active: true },
        { id: 6, name: 'L2', active: true },
      ])
    );
    service.adminGetLicenseSuggestionRules.and.returnValue(
      of({
        rules: [
          {
            id: 1,
            course_type: 'f',
            referee_license_level_id: 5,
            min_games: 4,
            field_size: 'GF',
            age_groups: [],
          },
        ],
        course_types: ['f'],
        field_sizes: ['all', 'KF', 'GF'],
        age_groups: [],
      })
    );
    TestBed.configureTestingModule({
      imports: [FormsModule, getTranslocoTestingModule()],
      declarations: [RefereeLicenseLevelsComponent, RulesStubComponent],
      providers: [
        provideRouter([]),
        { provide: RefereeService, useValue: service },
        {
          provide: SessionService,
          useValue: {
            currentUser$: new BehaviorSubject({
              permissions: { admin: admin },
            }),
          },
        },
        {
          provide: NotificationService,
          useValue: jasmine.createSpyObj('NotificationService', [
            'success',
            'error',
          ]),
        },
      ],
    });
    const fixture = TestBed.createComponent(RefereeLicenseLevelsComponent);
    fixture.detectChanges();
    return { fixture, service };
  }

  it('zeigt dem Admin die Vorschlagsregeln unter der jeweiligen Stufe', () => {
    const { fixture } = render(true);
    const stubs = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll(
        'fb-referee-license-suggestion-rules'
      )
    );
    expect(stubs.length).toBe(2);
    const c = fixture.componentInstance;
    expect(c.rulesFor({ id: 5, name: 'L1', active: true }).length).toBe(1);
    expect(c.rulesFor({ id: 6, name: 'L2', active: true }).length).toBe(0);
  });

  it('laedt die Regeln fuer andere Rollen gar nicht erst', () => {
    const { fixture, service } = render(false);
    expect(service.adminGetLicenseSuggestionRules).not.toHaveBeenCalled();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        'fb-referee-license-suggestion-rules'
      )
    ).toBeNull();
  });
});

// Mit der echten Regelkomponente: Eine Stufe ohne Regel bekam aus rulesFor()
// bei jedem Durchlauf ein neues leeres Array. Das ersetzte die Regeln der
// Kindkomponente, sobald die Seite neu geprüft wurde, und eine eben
// angelegte oder gespeicherte Regel verschwand wieder.
describe('RefereeLicenseLevelsComponent mit Regelpflege', () => {
  it('behaelt eine neue Regel bei einer Stufe ohne Regeln, auch gespeichert', () => {
    const service = jasmine.createSpyObj('RefereeService', [
      'adminGetLicenseLevels',
      'adminGetLicenseSuggestionRules',
      'adminSaveLicenseSuggestionRule',
    ]);
    service.adminGetLicenseLevels.and.returnValue(
      of([{ id: 6, name: 'L2', active: true }])
    );
    service.adminGetLicenseSuggestionRules.and.returnValue(
      of({
        rules: [],
        course_types: ['f'],
        field_sizes: ['all', 'KF', 'GF'],
        age_groups: [],
      })
    );
    service.adminSaveLicenseSuggestionRule.and.callFake(
      (rule: RefereeLicenseSuggestionRule) => of({ ...rule, id: 9 })
    );
    TestBed.configureTestingModule({
      imports: [FormsModule, getTranslocoTestingModule()],
      declarations: [
        RefereeLicenseLevelsComponent,
        RefereeLicenseSuggestionRulesComponent,
      ],
      providers: [
        provideRouter([]),
        { provide: RefereeService, useValue: service },
        {
          provide: SessionService,
          useValue: {
            currentUser$: new BehaviorSubject({ permissions: { admin: true } }),
          },
        },
        {
          provide: NotificationService,
          useValue: jasmine.createSpyObj('NotificationService', [
            'success',
            'error',
          ]),
        },
      ],
    });
    const fixture = TestBed.createComponent(RefereeLicenseLevelsComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    (el.querySelector('[data-test="add-rule"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelectorAll('[data-test="rule-form"]').length).toBe(1);

    const save = el.querySelector(
      '[data-test="rule-form"] button'
    ) as HTMLButtonElement;
    save.click();
    fixture.detectChanges();
    expect(el.querySelectorAll('[data-test="rule"]').length).toBe(1);

    // Bearbeiten der Stufe baut die Regelzeile neu auf.
    fixture.componentInstance.startEdit({ id: 6, name: 'L2', active: true });
    fixture.componentInstance.cancelEdit();
    fixture.componentRef.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(el.querySelectorAll('[data-test="rule"]').length).toBe(1);
  });
});
