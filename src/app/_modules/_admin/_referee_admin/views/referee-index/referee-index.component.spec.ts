import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { Observable, of } from 'rxjs';
import {
  AssociationService,
  RefereeService,
  SessionService,
} from '@floorball/core';
import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';
import { RefereeAdmin, User } from '@floorball/types';

import { RefereeIndexComponent } from './referee-index.component';

const referee = (overrides: Partial<RefereeAdmin>): RefereeAdmin =>
  ({
    id: 1,
    lizenznummer: 4711,
    lizenznummer_display: '4711',
    guest: false,
    vorname: 'Ida',
    nachname: 'Muster',
    ...overrides,
  }) as RefereeAdmin;

describe('RefereeIndexComponent', () => {
  let fixture: ComponentFixture<RefereeIndexComponent>;

  const accountBadges = (): HTMLElement[] =>
    Array.from(
      fixture.nativeElement.querySelectorAll('[title="Hat ein Benutzerkonto"]')
    );

  async function setUp(
    permissions: Record<string, boolean>,
    referees: RefereeAdmin[]
  ) {
    await TestBed.configureTestingModule({
      imports: [
        FormsModule,
        RouterTestingModule,
        // Die Übersetzungen stehen global unter dem Alias, nicht als
        // Scope-Schlüssel: Die Komponente steht hier ohne ihr Modul und damit
        // ohne dessen TRANSLOCO_SCOPE.
        getTranslocoTestingModule({
          de: {
            refereeAdmin: {
              index: {
                title: 'Schiedsrichterverwaltung',
                accounts: 'Benutzerkonten',
                hasAccountBadge: 'Konto',
                hasAccountTitle: 'Hat ein Benutzerkonto',
                colQualifications: 'Zusatzq.',
                qualificationValidUntil: 'bis {{ date }}',
                colQualificationsTitle: 'Zusatzqualifikation: {{ name }}',
                colQualificationsValidUntil:
                  'Zusatzqualifikation: {{ name }}, gültig bis {{ date }}',
                qualificationExpiredUntil: 'abgelaufen {{ date }}',
                colQualificationsExpiredAt:
                  'Zusatzqualifikation: {{ name }}, abgelaufen am {{ date }}',
                csvQualificationExpired: '{{ name }} (abgelaufen {{ date }})',
              },
            },
          },
        }),
      ],
      declarations: [RefereeIndexComponent],
      providers: [
        {
          provide: RefereeService,
          useValue: { adminGetAll: () => of(referees) },
        },
        {
          provide: AssociationService,
          useValue: { stateAssociations$: of([]) },
        },
        {
          provide: SessionService,
          useValue: {
            currentUser$: of({
              permissions,
            } as unknown as User) as Observable<User | null>,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RefereeIndexComponent);
    fixture.detectChanges();
  }

  // Punkt 1: In der Übersicht soll sichtbar sein, wer sich anmelden kann.
  it('zeigt das Konto-Badge nur beim Schiri mit Benutzerkonto', async () => {
    await setUp({ menu_item_referee_admin: true }, [
      referee({ id: 1, has_user: true }),
      referee({ id: 2, lizenznummer: 4712, has_user: false }),
    ]);

    expect(accountBadges().length).toBe(1);
    expect(accountBadges()[0].textContent!.trim()).toBe('Konto');
  });

  // Rollen ohne Zugriff auf Kontaktdaten (Vereinsmanager) bekommen has_user von
  // der API nicht mitgeliefert – dann darf auch kein Badge stehen.
  it('zeigt kein Badge, wenn die API has_user nicht mitliefert', async () => {
    await setUp({ menu_item_referee_admin: true }, [referee({ id: 1 })]);

    expect(accountBadges().length).toBe(0);
  });

  // Der Stufenfilter sucht auch in den Zusatzqualifikationen. Ohne die Marke in
  // der Zeile wäre der Trefferliste nicht anzusehen, warum jemand darin steht.
  it('zeigt die Zusatzqualifikationen neben der Lizenzstufe', async () => {
    await setUp({ menu_item_referee_admin: true }, [
      referee({
        id: 1,
        lizenzstufe: 'B',
        qualifications: [
          {
            qualification_type_id: 3,
            qualification_type_name: 'Beobachter',
            qualification_type_short_name: 'BEO',
            valid_until: '30.06.2028',
          },
        ],
      }),
    ]);

    const cell = fixture.nativeElement.querySelector(
      '[title="Zusatzqualifikation: Beobachter, gültig bis 30.06.2028"]'
    );

    expect(cell).not.toBeNull();
    // Kürzel und Gültigkeit stehen zusammen in der Spalte; der volle Name im Titel.
    expect(cell.textContent.replace(/\s+/g, ' ').trim()).toBe(
      'BEO bis 30.06.2028'
    );
  });

  // Der Stufenfilter findet bewusst auch den Altbestand. Eine abgelaufene
  // Qualifikation in derselben Optik wie eine laufende beantwortet die Frage
  // „wer ist Beobachter?" dann stillschweigend mit ihm mit.
  it('wertet eine abgelaufene Zusatzqualifikation sichtbar ab', async () => {
    await setUp({ menu_item_referee_admin: true }, [
      referee({
        id: 1,
        qualifications: [
          {
            qualification_type_id: 3,
            qualification_type_name: 'Beobachter',
            qualification_type_short_name: 'BEO',
            valid_until: '30.06.2024',
            expired: true,
          },
        ],
      }),
      referee({
        id: 2,
        lizenznummer: 4712,
        qualifications: [
          {
            qualification_type_id: 3,
            qualification_type_name: 'Beobachter',
            qualification_type_short_name: 'BEO',
            valid_until: '30.06.2028',
            expired: false,
          },
        ],
      }),
    ]);

    const abgelaufen = fixture.nativeElement.querySelector(
      '[title="Zusatzqualifikation: Beobachter, abgelaufen am 30.06.2024"]'
    );
    const laufend = fixture.nativeElement.querySelector(
      '[title="Zusatzqualifikation: Beobachter, gültig bis 30.06.2028"]'
    );

    expect(abgelaufen).not.toBeNull();
    expect(laufend).not.toBeNull();
    // Der Zustand hängt nicht am Titel allein: Die Zeile ist abgewertet und die
    // Gültigkeit trägt eine andere Klasse als die der laufenden Qualifikation.
    expect(abgelaufen.className).not.toBe(laufend.className);
    expect(abgelaufen.className).toContain('text-fb-gray-400');

    const klasse = (zelle: HTMLElement) =>
      zelle.querySelector('span:last-of-type')!.className;

    expect(klasse(abgelaufen)).not.toBe(klasse(laufend));
    expect(klasse(abgelaufen)).toContain('text-red-500');
    expect(abgelaufen.textContent.replace(/\s+/g, ' ').trim()).toBe(
      'BEO abgelaufen 30.06.2024'
    );
  });

  // Das Kürzel ist optional; ohne es muss der ausgeschriebene Name stehen,
  // sonst bliebe die Marke leer.
  it('nimmt den Namen, wenn kein Kürzel gepflegt ist', async () => {
    await setUp({ menu_item_referee_admin: true }, [
      referee({
        id: 1,
        lizenzstufe: 'A',
        qualifications: [
          { qualification_type_id: 4, qualification_type_name: 'Ausbilder' },
        ],
      }),
    ]);

    const cell = fixture.nativeElement.querySelector(
      '[title="Zusatzqualifikation: Ausbilder"]'
    );

    expect(cell).not.toBeNull();
    expect(cell.textContent.trim()).toBe('Ausbilder');
  });

  // Die Spalte „Region" trägt eine Zuordnung, keinen Fließtext – das Kürzel
  // reicht und lässt Platz für die Gültigkeit der Zusatzqualifikation.
  it('zeigt in der Region das Kürzel des Landesverbands', async () => {
    await setUp({ menu_item_referee_admin: true }, [
      referee({
        id: 1,
        landesverband: 'Floorball Verband Berlin',
        landesverband_short: 'FVB',
      }),
    ]);

    const cell = fixture.nativeElement.querySelector(
      '[title="Floorball Verband Berlin"]'
    );

    expect(cell).not.toBeNull();
    expect(cell.textContent.trim()).toBe('FVB');
  });

  // Das Kürzel ist in der Datenbank optional.
  it('faellt in der Region auf den vollen Namen zurueck', async () => {
    await setUp({ menu_item_referee_admin: true }, [
      referee({ id: 1, landesverband: 'Floorball Verband Berlin' }),
    ]);

    const cell = fixture.nativeElement.querySelector(
      '[title="Floorball Verband Berlin"]'
    );

    expect(cell.textContent.trim()).toBe('Floorball Verband Berlin');
  });

  it('verlinkt die Konto-Seite nicht ohne referee_account_tools', async () => {
    await setUp({ menu_item_referee_admin: true }, []);

    expect(fixture.componentInstance.canManageAccounts).toBeFalse();
    expect(fixture.nativeElement.textContent).not.toContain('Benutzerkonten');
  });

  it('verlinkt die Konto-Seite für die Verwaltung', async () => {
    await setUp(
      { menu_item_referee_admin: true, referee_account_tools: true },
      []
    );

    expect(fixture.componentInstance.canManageAccounts).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Benutzerkonten');
  });
});
