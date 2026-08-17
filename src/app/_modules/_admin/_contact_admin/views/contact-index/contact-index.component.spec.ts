import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';

import {
  ContactIndexComponent,
  CONTACT_CSV_HEADERS,
} from './contact-index.component';
import { ContactService, NotificationService } from '@floorball/core';
import { ContactClub, ContactList, ContactTeam } from '@floorball/types';
import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';

describe('ContactIndexComponent', () => {
  let component: ContactIndexComponent;
  let fixture: ComponentFixture<ContactIndexComponent>;
  let getContacts: jasmine.Spy;
  let notificationError: jasmine.Spy;

  const MAIL_COLUMN = CONTACT_CSV_HEADERS.indexOf('E-Mail');
  const ROLE_COLUMN = CONTACT_CSV_HEADERS.indexOf('Rolle');
  const LEAGUE_COLUMN = CONTACT_CSV_HEADERS.indexOf('Liga');
  const TEAM_COLUMN = CONTACT_CSV_HEADERS.indexOf('Mannschaft');

  const club = (partial: Partial<ContactClub>): ContactClub =>
    ({
      id: 1,
      name: 'Aal Berlin',
      contact_email: 'info@aal.example',
      state_association_name: 'FVBB',
      notify_managers: [],
      teams: [],
      ...partial,
    }) as ContactClub;

  const team = (partial: Partial<ContactTeam>): ContactTeam =>
    ({
      id: 10,
      name: 'Aal 1',
      league_id: 1,
      league_name: 'Regionalliga Ost',
      game_operation_name: 'SBK Ost',
      contact_person: null,
      contact_email: null,
      managers: [],
      ...partial,
    }) as ContactTeam;

  const manager = (id: number, name: string, email: string | null) => ({
    id,
    name,
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
          provide: NotificationService,
          useValue: { error: notificationError },
        },
      ],
    });

    fixture = TestBed.createComponent(ContactIndexComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('laedt beim Oeffnen genau einmal und ohne Saisonangabe', () => {
    setup();

    expect(getContacts).toHaveBeenCalledTimes(1);
    expect(getContacts).toHaveBeenCalledWith();
  });

  it('zaehlt einen Verein ohne erreichbaren Kontakt', () => {
    setup(
      list([
        club({ id: 1, contact_email: null, notify_managers: [] }),
        club({
          id: 2,
          contact_email: null,
          notify_managers: [manager(6, 'Anna Meier', 'anna@aal.example')],
        }),
        club({ id: 3, contact_email: 'info@drei.example' }),
      ])
    );

    expect(component.clubsWithoutContact).toBe(1);
  });

  it('zaehlt eine Mannschaft ohne Ansprechperson', () => {
    setup(
      list([
        club({
          teams: [
            team({ id: 10 }),
            team({ id: 11, contact_email: 'team2@aal.example' }),
            team({
              id: 12,
              managers: [manager(7, 'Bruno Sanchez', 'bruno@aal.example')],
            }),
          ],
        }),
      ])
    );

    expect(component.teamCount).toBe(3);
    expect(component.teamsWithoutContact).toBe(1);
  });

  it('sucht auch ueber Personen und Adressen', () => {
    setup(
      list([
        club({ id: 1, name: 'Aal Berlin' }),
        club({
          id: 2,
          name: 'Barsch Bremen',
          notify_managers: [manager(6, 'Anna Meier', 'anna@barsch.example')],
        }),
      ])
    );

    component.search = 'anna@barsch';

    expect(component.filteredClubs.map((c) => c.id)).toEqual([2]);
  });

  it('schreibt je Empfaenger eine CSV-Zeile', () => {
    setup(
      list([
        club({
          notify_managers: [manager(6, 'Anna Meier', 'anna@aal.example')],
          teams: [
            team({
              contact_person: 'Carla Wolf',
              contact_email: 'team1@aal.example',
              managers: [manager(7, 'Bruno Sanchez', 'bruno@aal.example')],
            }),
          ],
        }),
      ])
    );

    const rows = component.csvRows();

    expect(rows.map((row) => row[MAIL_COLUMN])).toEqual([
      'info@aal.example',
      'anna@aal.example',
      'team1@aal.example',
      'bruno@aal.example',
    ]);
    expect(rows.map((row) => row[ROLE_COLUMN])).toEqual([
      'Vereins-Kontaktadresse',
      'Vereinsmanager (Vereinspost)',
      'Mannschafts-Kontaktperson',
      'Teammanager',
    ]);
  });

  it('nennt die Liga der Mannschaft in einer eigenen Spalte', () => {
    setup(
      list([
        club({
          contact_email: null,
          teams: [
            team({
              managers: [manager(7, 'Bruno Sanchez', 'bruno@aal.example')],
            }),
          ],
        }),
      ])
    );

    const row = component.csvRows()[0];

    expect(row[TEAM_COLUMN]).toBe('Aal 1');
    expect(row[LEAGUE_COLUMN]).toBe('Regionalliga Ost');
  });

  it('laesst die Vereinszeile weg, wenn keine Adresse gepflegt ist', () => {
    setup(list([club({ contact_email: null })]));

    expect(component.csvRows()).toEqual([]);
  });

  it('schreibt auch fuer eine Mannschaft ohne Ansprechperson eine Zeile', () => {
    setup(list([club({ contact_email: null, teams: [team({})] })]));

    const rows = component.csvRows();

    expect(rows.length).toBe(1);
    expect(rows[0][TEAM_COLUMN]).toBe('Aal 1');
    expect(rows[0][MAIL_COLUMN]).toBe('');
  });

  // Eine Zeile mit falscher Laenge verschoebe stillschweigend alle Spalten
  // dahinter. Deshalb jede Zeilenart einmal gegen die Kopfzeile messen.
  it('haelt jede Zeilenart auf der Breite der Kopfzeile', () => {
    setup(
      list([
        club({
          notify_managers: [manager(6, 'Anna Meier', 'anna@aal.example')],
          teams: [
            team({
              id: 10,
              contact_person: 'Carla Wolf',
              contact_email: 'team1@aal.example',
              managers: [manager(7, 'Bruno Sanchez', 'bruno@aal.example')],
            }),
            team({ id: 11 }),
          ],
        }),
      ])
    );

    const rows = component.csvRows();

    expect(rows.length).toBe(5);
    for (const row of rows) {
      expect(row.length).toBe(CONTACT_CSV_HEADERS.length);
    }
  });

  it('meldet einen Fehlschlag, statt still leer zu bleiben', () => {
    setup();
    getContacts.and.returnValue(throwError(() => new Error('kaputt')));

    component.load();

    expect(notificationError).toHaveBeenCalled();
    expect(component.loading).toBeFalse();
  });
});
