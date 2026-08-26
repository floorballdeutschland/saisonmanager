import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NotificationService, RefereeService } from '@floorball/core';
import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';

import { RefereeAvailabilitiesComponent } from './referee-availabilities.component';

describe('RefereeAvailabilitiesComponent (Zeitraum der Ansicht)', () => {
  let fixture: ComponentFixture<RefereeAvailabilitiesComponent>;
  let component: RefereeAvailabilitiesComponent;
  let refereeService: { getAvailabilities: jasmine.Spy };

  async function setUp() {
    refereeService = {
      getAvailabilities: jasmine
        .createSpy('getAvailabilities')
        .and.returnValue(of([])),
    };

    await TestBed.configureTestingModule({
      imports: [getTranslocoTestingModule()],
      declarations: [RefereeAvailabilitiesComponent],
      providers: [
        { provide: RefereeService, useValue: refereeService },
        {
          provide: NotificationService,
          useValue: {
            success: jasmine.createSpy(),
            error: jasmine.createSpy(),
          },
        },
      ],
    })
      .overrideTemplate(RefereeAvailabilitiesComponent, '')
      .compileComponents();

    fixture = TestBed.createComponent(RefereeAvailabilitiesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function vormonat(): { year: number; month: number } {
    const heute = new Date();
    const d = new Date(heute.getFullYear(), heute.getMonth() - 1, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  }

  it('beginnt im Vormonat und endet im Dezember des Folgejahres', async () => {
    await setUp();

    const erster = component.months[0];
    const letzter = component.months[component.months.length - 1];

    expect({ year: erster.year, month: erster.month }).toEqual(vormonat());
    expect({ year: letzter.year, month: letzter.month }).toEqual({
      year: new Date().getFullYear() + 1,
      month: 11,
    });
  });

  it('zeigt keinen Monat vor dem Vormonat', async () => {
    await setUp();

    const start = vormonat();
    const frueher = component.months.filter(
      (m) => m.year * 12 + m.month < start.year * 12 + start.month
    );

    expect(frueher).toEqual([]);
  });

  it('fragt die Verfuegbarkeiten erst ab dem Vormonat ab', async () => {
    await setUp();

    const start = vormonat();
    expect(refereeService.getAvailabilities).toHaveBeenCalledWith({
      date_from: `${start.year}-${String(start.month + 1).padStart(2, '0')}-01`,
      date_to: `${new Date().getFullYear() + 1}-12-31`,
    });
  });

  it('fuehrt jeden Monat lueckenlos bis zum Ende der Ansicht', async () => {
    await setUp();

    const start = vormonat();
    const erwartet = component.months.length;
    const ende = new Date().getFullYear() + 1;
    expect(erwartet).toBe((ende - start.year) * 12 + 11 - start.month + 1);

    component.months.forEach((m, i) => {
      const laufend = start.year * 12 + start.month + i;
      expect({ year: m.year, month: m.month }).toEqual({
        year: Math.floor(laufend / 12),
        month: laufend % 12,
      });
    });
  });
});
