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

  const gameDay = (id: number, date: string): TeamGameDay => ({
    id,
    date,
    auto_confirmed: false,
    confirmable_from: null,
    checklist_required: true,
    checklist_items: [],
    my_teams: [],
    games: [],
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

  it('behaelt bei gleichem Datum die Reihenfolge der API', () => {
    const date = isoDaysFromToday(-1);
    setup([gameDay(11, date), gameDay(12, date), gameDay(13, date)]);

    expect(component.gameDays.map((gd) => gd.id)).toEqual([11, 12, 13]);
  });
});
