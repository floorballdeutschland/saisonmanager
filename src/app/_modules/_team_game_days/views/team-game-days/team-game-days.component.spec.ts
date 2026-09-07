import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { NotificationService, TeamService } from '@floorball/core';
import { TeamGameDay } from '@floorball/types';

import { TeamGameDaysComponent } from './team-game-days.component';

describe('TeamGameDaysComponent', () => {
  let component: TeamGameDaysComponent;
  let fixture: ComponentFixture<TeamGameDaysComponent>;
  let teamService: jasmine.SpyObj<TeamService>;

  const gameDay = (
    id: number,
    date: string,
    overrides: Partial<TeamGameDay> = {}
  ): TeamGameDay => ({
    id,
    date,
    auto_confirmed: false,
    confirmable_from: null,
    checklist_required: true,
    checklist_items: [],
    my_teams: [],
    games: [],
    ...overrides,
  });

  /** Spieltag mit einer Gastmannschaft, deren Bestaetigung noch aussteht. */
  const openGameDay = (id: number, date: string): TeamGameDay =>
    gameDay(id, date, {
      confirmable_from: `${date}T18:00:00`,
      my_teams: [
        {
          team_id: id * 10,
          team_name: `Team ${id}`,
          confirmed_at: null,
          properly_conducted: null,
          checklist_answers: [],
        },
      ],
    });

  function setup(days: TeamGameDay[]) {
    teamService = jasmine.createSpyObj('TeamService', [
      'getTeamGameDays',
      'confirmTeamGameDay',
    ]);
    teamService.getTeamGameDays.and.returnValue(of(days));

    TestBed.configureTestingModule({
      imports: [CommonModule],
      declarations: [TeamGameDaysComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: TeamService, useValue: teamService },
        {
          provide: NotificationService,
          useValue: jasmine.createSpyObj('NotificationService', [
            'success',
            'error',
          ]),
        },
      ],
    });

    fixture = TestBed.createComponent(TeamGameDaysComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => TestBed.resetTestingModule());

  function isoDaysFromToday(offset: number): string {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-');
  }

  it('stellt vergangene Spieltage vor die kuenftigen', () => {
    // Reihenfolge wie von der API geliefert: rein nach Datum absteigend.
    setup([
      gameDay(1, isoDaysFromToday(30)),
      gameDay(2, isoDaysFromToday(7)),
      gameDay(3, isoDaysFromToday(0)),
      gameDay(4, isoDaysFromToday(-3)),
      gameDay(5, isoDaysFromToday(-20)),
    ]);

    // Heute und Vergangenheit (neuester zuerst), danach die Zukunft
    // aufsteigend – der weit entfernte Spieltag steht nicht mehr oben.
    expect(component.gameDays.map((gd) => gd.id)).toEqual([3, 4, 5, 2, 1]);
  });

  it('sortiert mehrere Ligen desselben Tages nach Spieltags-ID', () => {
    // Die API sortiert nur nach Datum, die Reihenfolge gleicher Tage ist offen.
    const date = isoDaysFromToday(-1);
    setup([gameDay(13, date), gameDay(11, date), gameDay(12, date)]);

    expect(component.gameDays.map((gd) => gd.id)).toEqual([11, 12, 13]);
  });

  it('zieht einen offenen Spieltag ueber den heutigen ohne Handlungsbedarf', () => {
    // Heute laeuft der Spieltag noch (Bestaetigung erst ab Anpfiff des letzten
    // Spiels), gestern steht dagegen eine Bestaetigung offen.
    const today = gameDay(20, isoDaysFromToday(0), {
      confirmable_from: isoDaysFromToday(1) + 'T18:00:00',
      my_teams: [
        {
          team_id: 200,
          team_name: 'Heute',
          confirmed_at: null,
          properly_conducted: null,
          checklist_answers: [],
        },
      ],
    });
    setup([today, openGameDay(21, isoDaysFromToday(-1))]);

    expect(component.gameDays.map((gd) => gd.id)).toEqual([21, 20]);
  });
});
