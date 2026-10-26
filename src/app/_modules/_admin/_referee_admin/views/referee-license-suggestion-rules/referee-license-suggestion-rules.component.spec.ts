import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import {
  getTranslocoTestingModule,
  NotificationService,
  RefereeService,
} from '@floorball/core';
import { RefereeLicenseSuggestionRule } from '@floorball/types';
import { RefereeLicenseSuggestionRulesComponent } from './referee-license-suggestion-rules.component';

const rule: RefereeLicenseSuggestionRule = {
  id: 1,
  course_type: 'f',
  referee_license_level_id: 5,
  lizenzstufe: 'L1',
  position: 3,
  min_games: 4,
  field_size: 'GF',
  age_groups: ['Herren'],
};

describe('RefereeLicenseSuggestionRulesComponent', () => {
  function render() {
    const service = jasmine.createSpyObj('RefereeService', [
      'adminGetLicenseSuggestionRules',
      'adminGetLicenseLevels',
      'adminSaveLicenseSuggestionRule',
      'adminDeleteLicenseSuggestionRule',
    ]);
    service.adminGetLicenseSuggestionRules.and.returnValue(
      of({
        rules: [{ ...rule }],
        course_types: ['j', 'g', 'f'],
        field_sizes: ['all', 'KF', 'GF'],
        age_groups: ['Herren', 'U15 Junioren'],
      })
    );
    service.adminGetLicenseLevels.and.returnValue(
      of([
        { id: 5, name: 'L1', active: true },
        { id: 6, name: 'L2', active: true },
        { id: 7, name: 'Alt', active: false },
      ])
    );
    service.adminSaveLicenseSuggestionRule.and.callFake(
      (r: RefereeLicenseSuggestionRule) => of({ ...r, id: r.id ?? 9 })
    );
    service.adminDeleteLicenseSuggestionRule.and.returnValue(of(null));
    TestBed.configureTestingModule({
      imports: [FormsModule, getTranslocoTestingModule()],
      declarations: [RefereeLicenseSuggestionRulesComponent],
      providers: [
        { provide: RefereeService, useValue: service },
        {
          provide: NotificationService,
          useValue: jasmine.createSpyObj('NotificationService', [
            'success',
            'error',
          ]),
        },
      ],
    });
    const fixture = TestBed.createComponent(
      RefereeLicenseSuggestionRulesComponent
    );
    fixture.detectChanges();
    return { fixture, service, c: fixture.componentInstance };
  }

  it('laedt Regeln und bietet nur aktive Stufen an', () => {
    const { c } = render();
    expect(c.rules.length).toBe(1);
    expect(c.levels.map((l) => l.name)).toEqual(['L1', 'L2']);
    expect(c.ageGroups).toEqual(['Herren', 'U15 Junioren']);
  });

  it('haengt Altersklassen an und ab und speichert die Regel', () => {
    const { c, service } = render();
    const r = c.rules[0];
    c.toggleAgeGroup(r, 'U15 Junioren', true);
    c.toggleAgeGroup(r, 'Herren', false);
    c.save(r);
    expect(service.adminSaveLicenseSuggestionRule).toHaveBeenCalledWith(
      jasmine.objectContaining({ id: 1, age_groups: ['U15 Junioren'] })
    );
  });

  it('legt eine neue Regel hinter der letzten an', () => {
    const { c, service } = render();
    c.add();
    const fresh = c.rules[1];
    expect(fresh.position).toBe(4);
    expect(fresh.course_type).toBe('f');
    fresh.referee_license_level_id = 6;
    c.save(fresh);
    expect(c.rules[1].id).toBe(9);
    expect(service.adminSaveLicenseSuggestionRule).toHaveBeenCalled();
  });

  it('verwirft eine ungespeicherte Regel ohne Abruf', () => {
    const { c, service } = render();
    c.add();
    c.remove(c.rules[1]);
    expect(c.rules.length).toBe(1);
    expect(service.adminDeleteLicenseSuggestionRule).not.toHaveBeenCalled();
    c.remove(c.rules[0]);
    expect(service.adminDeleteLicenseSuggestionRule).toHaveBeenCalledWith(1);
  });
});
