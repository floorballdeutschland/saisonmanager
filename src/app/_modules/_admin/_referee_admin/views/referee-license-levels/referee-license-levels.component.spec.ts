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
