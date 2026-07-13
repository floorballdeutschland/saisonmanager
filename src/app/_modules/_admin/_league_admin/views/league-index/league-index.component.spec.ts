import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { getTranslocoTestingModule } from '@floorball/core';
import { LeagueIndexComponent } from './league-index.component';

describe('LeagueIndexComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [LeagueIndexComponent],
    })
      .overrideTemplate(LeagueIndexComponent, '')
      .compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(LeagueIndexComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('derives the previous season from the seasons catalog', () => {
    const fixture = TestBed.createComponent(LeagueIndexComponent);
    const httpMock = TestBed.inject(HttpTestingController);

    fixture.detectChanges();

    const initReq = httpMock.expectOne((r) => r.url.endsWith('init.json'));
    initReq.flush({
      seasons: [
        { id: 15, name: '2023/2024', current: false },
        { id: 16, name: '2024/2025', current: false },
        { id: 17, name: '2025/2026', current: true },
      ],
      current_season_id: 17,
      game_operations: [],
      state_associations: [],
    });

    expect(fixture.componentInstance.previousSeason?.id).toBe(16);
  });

  it('copies a league with the selected team ids and navigates to the edit view', () => {
    const fixture = TestBed.createComponent(LeagueIndexComponent);
    const component = fixture.componentInstance;
    const httpMock = TestBed.inject(HttpTestingController);
    const navigateSpy = spyOn(TestBed.inject(Router), 'navigate');

    component.copySourceLeagueId = 5;
    component.copySelectedTeamIds = new Set([11, 22]);
    component.submitCopy();

    const req = httpMock.expectOne((r) =>
      r.url.endsWith('admin/leagues/5/copy.json')
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ team_ids: [11, 22] });
    req.flush({ id: 99 });

    expect(navigateSpy).toHaveBeenCalledWith([
      '/',
      'verwaltung',
      'ligen',
      99,
      'bearbeiten',
    ]);
  });

  it('loads the source league teams and pre-selects all of them', () => {
    const fixture = TestBed.createComponent(LeagueIndexComponent);
    const component = fixture.componentInstance;
    const httpMock = TestBed.inject(HttpTestingController);

    component.copySourceLeagueId = 5;
    component.onCopySourceLeagueChange();

    const req = httpMock.expectOne((r) =>
      r.url.endsWith('admin/leagues/5/teams.json')
    );
    expect(req.request.method).toBe('GET');
    req.flush({ teams: [{ id: 11 }, { id: 22 }, { id: 33 }] });

    expect(component.copySourceTeams.length).toBe(3);
    expect(Array.from(component.copySelectedTeamIds).sort()).toEqual([
      11, 22, 33,
    ]);
    expect(component.allCopyTeamsSelected).toBeTrue();
  });
});
