import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { getTranslocoTestingModule, SessionService } from '@floorball/core';
import { UikitCommonModule } from '@floorball/uikit/common';
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

  // Vorbelegt ist immer nur ein Verein. Wuerde nur gegen dessen Mannschaften
  // eingedampft, loeschte das naechste Speichern die Zuordnungen des zweiten
  // Vereins -- ohne dass jemand die Auswahl angefasst haette.
  it('behaelt die Zuordnung eines zweiten Vereins beim Eindampfen', () => {
    const component = setup([role(4, 7), role(4, 8)]);
    component.clubsWithTeams = [
      { id: 7, name: 'Verein A', teams: [{ id: 99, name: 'A 1' }] },
      { id: 8, name: 'Verein B', teams: [{ id: 111, name: 'B 1' }] },
    ] as unknown as ClubWithTeams[];
    component.editableTeamIds = [99, 111, 4711];

    component['_pruneUnassignableTeamIds']();

    // 4711 gibt es in keiner sichtbaren Liste mehr -- tote Zuweisung.
    expect(component.editableTeamIds).toEqual([99, 111]);
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

// Archivieren und Loeschen liegen eingeklappt unter "Weitere Aktionen". Der
// Passwort-Reset bleibt davor sichtbar; bei einem archivierten Konto startet
// der Bereich offen, damit das Reaktivieren, auf das der Archiv-Hinweis oben
// verweist, ohne Aufklappen bereitsteht.
describe('UserEditComponent – Weitere Aktionen', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        FormsModule,
        UikitCommonModule,
        getTranslocoTestingModule(),
      ],
      declarations: [UserEditComponent],
    }).compileComponents();
  });

  // Ohne ngOnInit: Die Ladeanfragen sind hier nicht Gegenstand, die Maske
  // rendert allein aus `user` und `currentUser`.
  function render(permissions: Record<string, boolean>): {
    el: HTMLElement;
    component: UserEditComponent;
  } {
    const fixture = TestBed.createComponent(UserEditComponent);
    const component = fixture.componentInstance;
    spyOn(component, 'ngOnInit');
    component.user = {
      id: 12,
      username: 'konto',
      email: 'konto@example.org',
      roles: [],
      teams: [],
      archived_at: null,
    } as unknown as UserAdminEntry;
    component.currentUser = { id: 1, permissions } as unknown as User;
    fixture.detectChanges();
    return { el: fixture.nativeElement as HTMLElement, component };
  }

  const admin = { menu_item_user_admin: true, user_delete: true };

  function details(el: HTMLElement): HTMLDetailsElement | null {
    return el.querySelector('[data-testid="more-actions"] details');
  }

  it('legt Archivieren und Loeschen eingeklappt in einen Bereich', () => {
    const { el } = render(admin);

    expect(details(el)).not.toBeNull();
    expect(details(el)!.open).toBeFalse();
    expect(
      details(el)!.querySelector('[data-testid="archive-section"]')
    ).not.toBeNull();
    expect(
      details(el)!.querySelector('[data-testid="delete-section"]')
    ).not.toBeNull();
  });

  it('laesst den Passwort-Reset ausserhalb des Bereichs', () => {
    const { el } = render(admin);
    const resetButton = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('sendResetMail')
    );

    expect(resetButton).toBeDefined();
    expect(resetButton!.closest('details')).toBeNull();
  });

  // Ueber das echte Laden: ngOnInit holt das Konto, erst dessen archived_at
  // entscheidet, ob der Bereich offen startet.
  it('startet bei einem archivierten Konto nach dem Laden offen', () => {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: { snapshot: { params: { id: '12' } } },
    });
    TestBed.overrideProvider(SessionService, {
      useValue: {
        currentUser$: of({ id: 1, permissions: admin } as unknown as User),
      },
    });
    const fixture = TestBed.createComponent(UserEditComponent);
    fixture.detectChanges();

    TestBed.inject(HttpTestingController)
      .match((req) => req.url.endsWith('/12.json'))
      .forEach((req) =>
        req.flush({
          id: 12,
          username: 'konto',
          email: 'konto@example.org',
          roles: [],
          teams: [],
          archived_at: '2026-10-01T10:00:00Z',
        })
      );
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(details(el)!.open).toBeTrue();
    expect(details(el)!.textContent).toContain('unarchiveButton');
  });

  it('fehlt ganz, wenn weder Archivieren noch Loeschen erlaubt ist', () => {
    const { el, component } = render({});

    expect(component.showMoreActions).toBeFalse();
    expect(el.querySelector('[data-testid="more-actions"]')).toBeNull();
  });
});
