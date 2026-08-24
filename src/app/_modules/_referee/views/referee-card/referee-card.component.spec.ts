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
    { qualification_type_name: 'Beobachter', valid_until: '31.12.2099' },
    { qualification_type_name: 'Spielleiter', valid_until: '31.01.2020' },
    { qualification_type_name: 'Ohne Ablauf', valid_until: null },
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

  // Der vollstaendige Name, nicht das Kuerzel: Die Karte wird von Dritten
  // gelesen, die „BEO" nicht auflösen koennen.
  it('zeichnet den Ausweis mit jeder Zusatzqualifikation', async () => {
    await setUp(PROFILE);

    const labels = queryAll('[data-testid="qualification-name"]').map((el) =>
      el.textContent!.trim()
    );

    expect(labels).toEqual(['Beobachter', 'Spielleiter', 'Ohne Ablauf']);
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
    // Nicht allein die Farbe: Abgelaufenes ist zusaetzlich durchgestrichen.
    expect(values[1].classList).toContain('line-through');
    expect(values[2].classList).not.toContain('text-red-600');
    expect(values[2].classList).not.toContain('text-green-600');
    expect(values[2].classList).not.toContain('line-through');
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

  // Der Ausweis darf die Lizenz am Ablauftag nicht schon als abgelaufen
  // ausweisen: Die API zaehlt diesen Tag noch mit.
  it('weist die Lizenz am Ablauftag noch als gueltig aus', async () => {
    const heute = new Date();
    const heuteDeutsch = [
      String(heute.getDate()).padStart(2, '0'),
      String(heute.getMonth() + 1).padStart(2, '0'),
      heute.getFullYear(),
    ].join('.');

    await setUp({ ...PROFILE, gueltigkeit: heuteDeutsch });

    expect(component.expired).toBeFalse();
  });

  // Ohne Nachweis dagegen abgelaufen, nicht faelschlich gruen.
  it('weist eine Lizenz ohne Gueltigkeit als abgelaufen aus', async () => {
    await setUp({ ...PROFILE, gueltigkeit: undefined });

    expect(component.expired).toBeTrue();
  });
});
