import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, of, throwError } from 'rxjs';

import {
  ContactIndexComponent,
  CONTACT_CSV_HEADERS,
} from './contact-index.component';
import {
  AssociationService,
  ContactService,
  NotificationService,
} from '@floorball/core';
import { ContactClub, ContactList } from '@floorball/types';
import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';

describe('ContactIndexComponent', () => {
  let component: ContactIndexComponent;
  let fixture: ComponentFixture<ContactIndexComponent>;
  let getContacts: jasmine.Spy;
  let notificationError: jasmine.Spy;

  const club = (partial: Partial<ContactClub>): ContactClub =>
    ({
      id: 1,
      name: 'Aal Berlin',
      contact_email: 'info@aal.example',
      state_association_name: 'FVBB',
      managers: [],
      teams: [],
      ...partial,
    }) as ContactClub;

  const manager = (id: number, name: string, email: string | null) => ({
    id,
    name,
    username: `u${id}`,
    email,
    last_login_at: null,
  });

  const list = (clubs: ContactClub[]): ContactList => ({
    season_id: '18',
    clubs,
  });

  function setup(response = list([])) {
    getContacts = jasmine
      .createSpy('getContacts')
      .and.returnValue(of(response));
    notificationError = jasmine.createSpy('error');

    TestBed.configureTestingModule({
      imports: [FormsModule, getTranslocoTestingModule()],
      declarations: [ContactIndexComponent],
      providers: [
        { provide: ContactService, useValue: { getContacts } },
        {
          provide: AssociationService,
          useValue: {
            seasons$: of([
              { id: 17, name: '2025/2026', current: false },
              { id: 18, name: '2026/2027', current: true },
            ]),
            currentSeasonId$: new BehaviorSubject(18),
          },
        },
        {
          provide: NotificationService,
          useValue: { error: notificationError },
        },
      ],
    });

    fixture = TestBed.createComponent(ContactIndexComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('laedt beim Oeffnen die laufende Saison', () => {
    setup();

    expect(getContacts).toHaveBeenCalledWith('18');
    expect(component.seasonId).toBe('18');
  });

  it('sortiert die Saisonauswahl absteigend', () => {
    setup();

    expect(component.seasons.map((s) => s.id)).toEqual([18, 17]);
  });

  it('laedt bei einem Saisonwechsel neu', () => {
    setup();

    component.onSeasonChange('17');

    expect(getContacts).toHaveBeenCalledWith('17');
  });

  it('zaehlt die Luecken', () => {
    setup(
      list([
        club({
          id: 1,
          managers: [],
          teams: [
            {
              id: 10,
              name: 'Aal 1',
              league_id: 1,
              league_name: 'RL Ost',
              game_operation_name: 'SBK Ost',
              contact_person: null,
              contact_email: null,
              managers: [],
            },
            {
              id: 11,
              name: 'Aal 2',
              league_id: 1,
              league_name: 'RL Ost',
              game_operation_name: 'SBK Ost',
              contact_person: null,
              contact_email: null,
              managers: [manager(5, 'Bruno Sanchez', 'bruno@aal.example')],
            },
          ],
        }),
        club({
          id: 2,
          name: 'Barsch Bremen',
          managers: [manager(6, 'Anna Meier', 'anna@barsch.example')],
        }),
      ])
    );

    expect(component.teamCount).toBe(2);
    expect(component.clubsWithoutManager).toBe(1);
    expect(component.teamsWithoutContact).toBe(1);
  });

  it('sucht auch ueber Personen und Adressen', () => {
    setup(
      list([
        club({ id: 1, name: 'Aal Berlin' }),
        club({
          id: 2,
          name: 'Barsch Bremen',
          managers: [manager(6, 'Anna Meier', 'anna@barsch.example')],
        }),
      ])
    );

    component.search = 'anna@barsch';

    expect(component.filteredClubs.map((c) => c.id)).toEqual([2]);
  });

  it('schreibt je Ansprechperson eine CSV-Zeile', () => {
    setup(
      list([
        club({
          id: 1,
          managers: [manager(6, 'Anna Meier', 'anna@aal.example')],
          teams: [
            {
              id: 10,
              name: 'Aal 1',
              league_id: 1,
              league_name: 'RL Ost',
              game_operation_name: 'SBK Ost',
              contact_person: 'Carla Wolf',
              contact_email: 'team1@aal.example',
              managers: [manager(7, 'Bruno Sanchez', 'bruno@aal.example')],
            },
          ],
        }),
      ])
    );

    const rows = component.csvRows();

    expect(CONTACT_CSV_HEADERS).toContain('E-Mail');
    expect(rows.length).toBe(2);
    expect(rows[0]).toContain('Vereinsmanager');
    expect(rows[0]).toContain('anna@aal.example');
    expect(rows[1]).toContain('Teammanager');
    expect(rows[1]).toContain('Aal 1');
    expect(rows[1]).toContain('bruno@aal.example');
  });

  it('schreibt auch fuer eine Mannschaft ohne Ansprechperson eine Zeile', () => {
    setup(
      list([
        club({
          id: 1,
          managers: [],
          teams: [
            {
              id: 10,
              name: 'Aal 1',
              league_id: 1,
              league_name: 'RL Ost',
              game_operation_name: 'SBK Ost',
              contact_person: null,
              contact_email: null,
              managers: [],
            },
          ],
        }),
      ])
    );

    const rows = component.csvRows();

    expect(rows.length).toBe(2);
    expect(rows[1]).toContain('Aal 1');
    expect(rows[1]).toContain('Teammanager');
  });

  it('meldet einen Fehlschlag, statt still leer zu bleiben', () => {
    setup();
    getContacts.and.returnValue(throwError(() => new Error('kaputt')));

    component.load();

    expect(notificationError).toHaveBeenCalled();
    expect(component.loading).toBeFalse();
  });
});
