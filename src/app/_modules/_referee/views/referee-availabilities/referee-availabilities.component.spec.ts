import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NotificationService, RefereeService } from '@floorball/core';
import { RefereeAvailabilityEntry } from '@floorball/types';
import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';

import { RefereeAvailabilitiesComponent } from './referee-availabilities.component';

const MONATE = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

describe('RefereeAvailabilitiesComponent (Zeitraum der Ansicht)', () => {
  let fixture: ComponentFixture<RefereeAvailabilitiesComponent>;
  let component: RefereeAvailabilitiesComponent;
  let refereeService: { getAvailabilities: jasmine.Spy };

  async function setUp(
    heute: Date,
    verfuegbarkeiten: RefereeAvailabilityEntry[] = []
  ) {
    refereeService = {
      getAvailabilities: jasmine
        .createSpy('getAvailabilities')
        .and.returnValue(of(verfuegbarkeiten)),
    };

    await TestBed.configureTestingModule({
      imports: [
        getTranslocoTestingModule({
          de: { refereeSelf: { availabilities: { months: MONATE } } },
        }),
      ],
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

    // Die Komponente haelt "heute" fest, sobald sie erzeugt wird. Die Uhr steht
    // deshalb nur um die Erzeugung herum: So pruefen die Tests feste
    // Kalenderfaelle statt des Datums, an dem CI gerade laeuft.
    jasmine.clock().install();
    jasmine.clock().mockDate(heute);
    try {
      fixture = TestBed.createComponent(RefereeAvailabilitiesComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    } finally {
      jasmine.clock().uninstall();
    }
  }

  // Der riskante Fall: Im Januar liegt der Vormonat im Vorjahr.
  it('beginnt im Januar mit dem Dezember des Vorjahres', async () => {
    await setUp(new Date(2026, 0, 15, 12));

    expect(component.months[0].label).toBe('Dezember 2025');
    expect(refereeService.getAvailabilities).toHaveBeenCalledWith({
      date_from: '2025-12-01',
      date_to: '2027-12-31',
    });
  });

  it('beginnt im Dezember mit dem November desselben Jahres', async () => {
    await setUp(new Date(2026, 11, 15, 12));

    expect(component.months[0].label).toBe('November 2026');
    expect(refereeService.getAvailabilities).toHaveBeenCalledWith({
      date_from: '2026-11-01',
      date_to: '2027-12-31',
    });
  });

  it('fuehrt die Monate lueckenlos vom Vormonat bis zum Ende der Ansicht', async () => {
    await setUp(new Date(2026, 7, 26, 12));

    // Juli 2026 bis Dezember 2027, beide inklusive.
    expect(component.months.map((m) => m.label)).toEqual([
      'Juli 2026',
      'August 2026',
      'September 2026',
      'Oktober 2026',
      'November 2026',
      'Dezember 2026',
      'Januar 2027',
      'Februar 2027',
      'März 2027',
      'April 2027',
      'Mai 2027',
      'Juni 2027',
      'Juli 2027',
      'August 2027',
      'September 2027',
      'Oktober 2027',
      'November 2027',
      'Dezember 2027',
    ]);
  });

  // Der Vormonat bleibt sichtbar, damit die zuletzt gemeldeten Tage noch
  // nachvollziehbar sind. Aendern laesst sich dort nichts mehr.
  it('zeigt die gemeldeten Tage des Vormonats, aber nur noch lesend', async () => {
    await setUp(new Date(2026, 7, 26, 12), [{ id: 42, date: '2026-07-15' }]);

    const vormonat = component.months[0];
    const gemeldet = vormonat.days.find((d) => d.iso === '2026-07-15')!;

    expect(gemeldet.available).toBeTrue();
    expect(gemeldet.availabilityId).toBe(42);
    expect(vormonat.days.every((d) => d.past)).toBeTrue();

    // Ein vergangener Tag darf sich nicht loeschen lassen.
    component.onDayClick(gemeldet);
    expect(component.saving).toBeFalse();

    // Heute bleibt auswaehlbar, der Vortag nicht.
    const laufend = component.months[1].days;
    expect(laufend.find((d) => d.iso === '2026-08-26')!.past).toBeFalse();
    expect(laufend.find((d) => d.iso === '2026-08-25')!.past).toBeTrue();
  });
});
