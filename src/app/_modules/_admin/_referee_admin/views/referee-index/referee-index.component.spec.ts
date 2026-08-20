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
            currentUser$: of({ permissions } as unknown as User) as Observable<
              User | null
            >,
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
