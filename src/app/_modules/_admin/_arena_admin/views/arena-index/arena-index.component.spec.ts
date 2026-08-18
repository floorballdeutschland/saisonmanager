import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { Observable, of } from 'rxjs';
import { ArenaService, SessionService } from '@floorball/core';
import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';
import { Arena, User } from '@floorball/types';

import { ArenaIndexComponent } from './arena-index.component';

// Die Produktionsdaten enthalten Altbestand ohne Namen bzw. ohne Stadt
// (Import 2010–2014); `Arena.name` ist in der DB nicht NOT NULL. Deshalb steht
// hier bewusst ein Eintrag mit name/city = null in der Liste.
const ARENAS = [
  { id: 1, name: 'Sporthalle Rohrdorf', city: 'Rohrdorf', active: true },
  { id: 2, name: 'Ballspielhalle', city: null, active: false },
  { id: 3, name: null, city: null, active: false },
  { id: 4, name: 'Halle am Park', city: 'Berlin', active: true },
] as unknown as Arena[];

describe('ArenaIndexComponent', () => {
  let fixture: ComponentFixture<ArenaIndexComponent>;

  const searchInput = (): HTMLInputElement =>
    fixture.nativeElement.querySelector('input[type="text"]');

  const rowNames = (): string[] =>
    Array.from(
      fixture.nativeElement.querySelectorAll('tbody tr td:first-child')
    ).map((td) => (td as HTMLElement).textContent!.trim());

  // Der Zustand wird als Attribut mitgegeben statt über den sichtbaren Text
  // geprüft: Der Scope `admin/arena` löst im TestBed nicht auf, die Zellen
  // enthielten also nur den rohen Übersetzungs-Key.
  const rowStatus = (): (string | null)[] =>
    Array.from(
      fixture.nativeElement.querySelectorAll('tbody tr td[data-status]')
    ).map((td) => (td as HTMLElement).getAttribute('data-status'));

  const inactiveCheckbox = (): HTMLInputElement =>
    fixture.nativeElement.querySelector('input[type="checkbox"]');

  const type = (value: string): void => {
    searchInput().value = value;
    searchInput().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        FormsModule,
        RouterTestingModule,
        getTranslocoTestingModule({
          'admin/arena': {
            index: {
              title: 'Spielorte',
              createNew: 'Neuen Spielort anlegen',
              searchPlaceholder: 'Nach Name oder Stadt suchen…',
              loading: 'Lade Spielorte…',
              count: '{{ filtered }} von {{ total }} Einträgen',
              colName: 'Name',
              colCity: 'Stadt',
              colAddress: 'Adresse',
              colStatus: 'Status',
              statusActive: 'Aktiv',
              statusInactive: 'Inaktiv',
              statusInactiveHint:
                'Dieser Spielort steht im Spieltag nicht zur Auswahl.',
              onlyInactive: 'Nur inaktive Spielorte',
              edit: 'Bearbeiten',
              merge: 'Zusammenlegen',
              delete: 'Löschen',
              empty: 'Keine Spielorte gefunden.',
            },
          },
        }),
      ],
      declarations: [ArenaIndexComponent],
      providers: [
        {
          provide: ArenaService,
          useValue: { getAdminArenas: () => of(ARENAS) },
        },
        {
          provide: SessionService,
          useValue: {
            currentUser$: of({
              permissions: {},
            } as unknown as User) as Observable<User | null>,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ArenaIndexComponent);
    fixture.detectChanges();
  });

  it('zeigt zunächst alle Spielorte', () => {
    expect(rowNames().length).toBe(4);
  });

  it('filtert nach dem Namen', () => {
    type('rohrdorf');
    expect(rowNames()).toEqual(['Sporthalle Rohrdorf']);
  });

  it('filtert nach der Stadt', () => {
    type('berlin');
    expect(rowNames()).toEqual(['Halle am Park']);
  });

  // #451: der Zustand war in der Verwaltung nirgends zu sehen, obwohl er
  // darüber entscheidet, ob der Spielort im Spieltag zur Auswahl steht.
  it('zeigt je Spielort, ob er aktiv ist', () => {
    expect(rowStatus()).toEqual(['active', 'inactive', 'inactive', 'active']);
  });

  it('filtert auf Wunsch nur die inaktiven Spielorte', () => {
    inactiveCheckbox().click();
    fixture.detectChanges();

    expect(rowNames()).toEqual(['Ballspielhalle', '']);
  });

  it('kombiniert den Inaktiv-Filter mit der Suche', () => {
    inactiveCheckbox().click();
    fixture.detectChanges();
    type('halle');

    expect(rowNames()).toEqual(['Ballspielhalle']);
  });

  // Regression: ein einziger Spielort ohne Namen ließ `filteredArenas` bei
  // jedem Tastendruck an `name.toLowerCase()` scheitern. Die Suche sah dadurch
  // funktionslos aus – die Liste blieb unverändert stehen.
  it('filtert auch bei Spielorten ohne Namen oder Stadt', () => {
    type('halle');
    expect(rowNames()).toEqual([
      'Sporthalle Rohrdorf',
      'Ballspielhalle',
      'Halle am Park',
    ]);
  });
});
