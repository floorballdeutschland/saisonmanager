import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { getTranslocoTestingModule } from '@floorball/core';
import {
  ClubWithTeams,
  User,
  UserAdminEntry,
  UserAdminRole,
} from '@floorball/types';

import { UserEditComponent } from './user-edit.component';

// Ein Vereinsmanager kann zusätzlich eine Mannschaft betreuen. Die Maske
// behandelte Vereins- und Teammanager-Rolle aber als Entweder-oder: Sie las
// „die" Vereinsrolle des Kontos und fand bei einem VM mit zusätzlicher
// TM-Rolle die VM-Rolle. Die Mannschaftsauswahl blieb damit verborgen -- die
// TM-Rolle stand am Konto, ohne je eine Mannschaft zu bekommen.
describe('UserEditComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [UserEditComponent],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideTemplate(UserEditComponent, '')
      .compileComponents();
  });

  function role(userGroupId: number, clubId: number | null = 7): UserAdminRole {
    return {
      user_group_id: userGroupId,
      role_name: userGroupId === 4 ? 'Vereinsmanager' : 'Teammanager',
      club_id: clubId,
      game_operation_id: null,
    };
  }

  // Ohne ngOnInit: Die Getter lesen allein `user`, `currentUser` und die
  // geladenen Vereine. Ein detectChanges würde nur die Ladeanfragen auslösen.
  function setup(roles: UserAdminRole[]): UserEditComponent {
    const component =
      TestBed.createComponent(UserEditComponent).componentInstance;
    component.user = {
      id: 12,
      roles,
      teams: [],
    } as unknown as UserAdminEntry;
    // Angemeldet ist eine Verbandsrolle, die Vereins- und Teammanager-Rollen
    // vergeben darf -- sonst blendet die Maske die Abschnitte schon wegen der
    // eigenen Rechte aus.
    component.currentUser = {
      id: 1,
      permissions: {
        menu_item_user_admin: true,
        manage_user_roles: true,
        assign_role_vm: true,
        assign_role_tm: true,
      },
    } as unknown as User;
    component.clubsWithTeams = [
      {
        id: 7,
        name: 'Verein',
        teams: [{ id: 99, name: 'Team 1' }],
      } as unknown as ClubWithTeams,
    ];
    component.selectedClubId = 7;
    return component;
  }

  it('zeigt die Mannschaftsauswahl für einen Teammanager', () => {
    expect(setup([role(5)]).showTeamAssignment).toBeTrue();
  });

  it('zeigt die Mannschaftsauswahl auch, wenn die VM-Rolle zuerst steht', () => {
    const component = setup([role(4), role(5)]);

    expect(component.hasVmAndTmRole).toBeTrue();
    expect(component.showTeamAssignment).toBeTrue();
  });

  // Ein Vereinsmanager kann sich Mannschaften seines Vereins zuordnen und wird
  // für diese behandelt wie ein Teammanager -- ohne zweite Rolle. Vorher war
  // dafür der Umweg über ein Downgrade zum TM und zurück nötig.
  it('zeigt die Mannschaftsauswahl auch einem reinen Vereinsmanager', () => {
    const component = setup([role(4)]);

    expect(component.hasVmAndTmRole).toBeFalse();
    expect(component.isVmWithoutTmRole).toBeTrue();
    expect(component.showTeamAssignment).toBeTrue();
  });

  it('haelt den Hinweis fuer ein Konto mit beiden Rollen auseinander', () => {
    expect(setup([role(4), role(5)]).isVmWithoutTmRole).toBeFalse();
    expect(setup([role(5)]).isVmWithoutTmRole).toBeFalse();
  });

  // Ohne Mannschaften des Vereins gibt es nichts auszuwaehlen.
  it('zeigt sie ohne zuweisbare Mannschaften niemandem', () => {
    const component = setup([role(4)]);
    component.clubsWithTeams = [];

    expect(component.showTeamAssignment).toBeFalse();
  });

  // Der Umschalter ersetzt die Vereinsrolle, er ergänzt sie nicht: Der Server
  // bildet jede Vereinsrolle des Kontos auf die neue ab. An einem Konto mit
  // beiden Rollen wäre das ein stiller Verlust.
  it('bietet einem Konto mit beiden Rollen keinen Rollenwechsel an', () => {
    expect(setup([role(4), role(5)]).canChangeRole).toBeFalse();
  });

  it('bietet einem reinen Teammanager den Rollenwechsel weiter an', () => {
    expect(setup([role(5)]).canChangeRole).toBeTrue();
  });

  it('zeigt die Vereinszuweisung für beide Rollen', () => {
    expect(setup([role(4), role(5)]).showClubAssignment).toBeTrue();
    expect(setup([role(5)]).showClubAssignment).toBeTrue();
  });
});
