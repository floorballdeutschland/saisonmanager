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

const rule = (): RefereeLicenseSuggestionRule => ({
  id: 1,
  course_type: 'f',
  referee_license_level_id: 5,
  lizenzstufe: 'L1',
  min_games: 4,
  field_size: 'GF',
  age_groups: ['Herren'],
});

describe('RefereeLicenseSuggestionRulesComponent', () => {
  function render(rules: RefereeLicenseSuggestionRule[] = [rule()]) {
    const service = jasmine.createSpyObj('RefereeService', [
      'adminSaveLicenseSuggestionRule',
      'adminDeleteLicenseSuggestionRule',
    ]);
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
    fixture.componentRef.setInput('levelId', 5);
    fixture.componentRef.setInput('options', {
      course_types: ['f', 'g'],
      field_sizes: ['all', 'KF', 'GF'],
      age_groups: ['Herren', 'U15 Junioren'],
    });
    fixture.componentRef.setInput('rules', rules);
    fixture.detectChanges();
    return { fixture, service, c: fixture.componentInstance };
  }

  const el = (f: { nativeElement: HTMLElement }) => f.nativeElement;

  it('zeigt bestehende Regeln als Zeile, nicht als Formular', () => {
    const { fixture } = render();
    expect(el(fixture).querySelectorAll('[data-test="rule"]').length).toBe(1);
    expect(el(fixture).querySelector('[data-test="rule-form"]')).toBeNull();
  });

  it('legt eine neue Regel fuer diese Stufe an', () => {
    const { fixture, c, service } = render([]);
    (
      el(fixture).querySelector('[data-test="add-rule"]') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(el(fixture).querySelector('[data-test="rule-form"]')).not.toBeNull();

    c.save(c.rules[0]);
    expect(service.adminSaveLicenseSuggestionRule).toHaveBeenCalledWith(
      jasmine.objectContaining({
        referee_license_level_id: 5,
        course_type: 'f',
        min_games: null,
      })
    );
    expect(c.rules[0].id).toBe(9);
    expect(c.editing.size).toBe(0);
  });

  it('haengt Altersklassen an und ab', () => {
    const { c, service } = render();
    const r = c.rules[0];
    c.edit(r);
    c.toggleAgeGroup(r, 'U15 Junioren', true);
    c.toggleAgeGroup(r, 'Herren', false);
    c.save(r);
    expect(service.adminSaveLicenseSuggestionRule).toHaveBeenCalledWith(
      jasmine.objectContaining({ id: 1, age_groups: ['U15 Junioren'] })
    );
  });

  it('laesst die letzte Altersklasse nicht abwaehlen', () => {
    const { fixture, c } = render();
    const r = c.rules[0];
    // Ueber den Knopf, damit OnPush neu zeichnet.
    (
      el(fixture).querySelector(
        '[data-test="rule"] button'
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(c.editing.has(r)).toBeTrue();
    const boxes = el(fixture).querySelectorAll<HTMLInputElement>(
      '[data-test="rule-form"] input[type="checkbox"]'
    );
    expect(boxes[0].disabled).toBeTrue();
    expect(boxes[1].disabled).toBeFalse();

    c.toggleAgeGroup(r, 'Herren', false);
    expect(r.age_groups).toEqual(['Herren']);
  });

  it('speichert eine Regel mit Mindestzahl nicht ohne Altersklasse', () => {
    const { fixture, c, service } = render([{ ...rule(), age_groups: [] }]);
    const r = c.rules[0];
    // Ueber den Knopf, damit OnPush neu zeichnet.
    (
      el(fixture).querySelector(
        '[data-test="rule"] button'
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(c.editing.has(r)).toBeTrue();
    expect(
      el(fixture).querySelector('[data-test="age-groups-required"]')
    ).not.toBeNull();
    expect(
      (
        el(fixture).querySelector(
          '[data-test="save-rule"]'
        ) as HTMLButtonElement
      ).disabled
    ).toBeTrue();

    c.save(r);
    expect(service.adminSaveLicenseSuggestionRule).not.toHaveBeenCalled();

    r.min_games = null;
    c.save(r);
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
