import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NotificationService, RefereeService } from '@floorball/core';
import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';
import { RefereeProfile } from '@floorball/types';

import { RefereeCardComponent } from './referee-card.component';

const PROFILE: RefereeProfile = {
  id: 5,
  lizenznummer: 4711,
  lizenznummer_display: '4711',
  vorname: 'Anna',
  nachname: 'Beispiel',
  lizenzstufe: 'A',
  gueltigkeit: '30.06.2099',
  qualifications: [
    { qualification_type_name: 'Beobachter', short_name: 'BEO', valid_until: '31.12.2099' },
    { qualification_type_name: 'Spielleiter', short_name: 'SL', valid_until: '31.01.2020' },
    { qualification_type_name: 'Ohne Ablauf', short_name: null, valid_until: null },
  ],
};

describe('RefereeCardComponent (Zusatzqualifikationen)', () => {
  let fixture: ComponentFixture<RefereeCardComponent>;
  let component: RefereeCardComponent;

  async function setUp(profile: RefereeProfile) {
    await TestBed.configureTestingModule({
      imports: [CommonModule, getTranslocoTestingModule()],
      declarations: [RefereeCardComponent],
      providers: [
        {
          provide: RefereeService,
          useValue: {
            getProfile: jasmine
              .createSpy('getProfile')
              .and.returnValue(of(profile)),
          },
        },
        {
          provide: NotificationService,
          useValue: { error: jasmine.createSpy('error') },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RefereeCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function queryAll(selector: string): HTMLElement[] {
    const host = fixture.nativeElement as HTMLElement;
    return Array.from(host.querySelectorAll<HTMLElement>(selector));
  }

  it('zeichnet den Ausweis mit jeder Zusatzqualifikation, Kurzname bevorzugt', async () => {
    await setUp(PROFILE);

    const labels = queryAll('[data-testid="qualification-name"]').map((el) =>
      el.textContent!.trim()
    );

    // Ohne Kurzname steht der vollstaendige Name da.
    expect(labels).toEqual(['BEO', 'SL', 'Ohne Ablauf']);
  });

  it('faerbt eine gueltige Qualifikation gruen, eine abgelaufene rot und eine ohne Ablauf gar nicht', async () => {
    await setUp(PROFILE);

    const values = queryAll('[data-testid="qualification-validity"]');

    expect(values.map((el) => el.textContent!.trim())).toEqual([
      '31.12.2099',
      '31.01.2020',
      '–',
    ]);
    expect(values[0].classList).toContain('text-green-600');
    expect(values[1].classList).toContain('text-red-600');
    expect(values[2].classList).not.toContain('text-red-600');
    expect(values[2].classList).not.toContain('text-green-600');
  });

  // Der Abschnitt darf nicht als leere Ueberschrift stehenbleiben.
  it('laesst den Abschnitt weg, wenn keine Qualifikation hinterlegt ist', async () => {
    await setUp({ ...PROFILE, qualifications: [] });

    expect(component.qualifications).toEqual([]);
    expect(queryAll('[data-testid="qualification-name"]')).toEqual([]);
  });

  // Ein Datum, das es nicht gibt, darf nicht faelschlich als gueltig (gruen)
  // durchgehen; eine fehlende Angabe ist dagegen keine Aussage.
  it('haelt eine unlesbare Gueltigkeit fuer abgelaufen, eine fehlende nicht', async () => {
    await setUp(PROFILE);

    expect(component.qualificationExpired('31.02.2099')).toBeTrue();
    expect(component.qualificationExpired(null)).toBeFalse();
    expect(component.qualificationExpired(undefined)).toBeFalse();
  });
});
