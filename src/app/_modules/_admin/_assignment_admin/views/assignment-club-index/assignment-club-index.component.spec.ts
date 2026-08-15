import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { environment } from 'src/environments/environment';
import { getTranslocoTestingModule } from '@floorball/core';
import { AssignmentClubIndexComponent } from './assignment-club-index.component';

describe('AssignmentClubIndexComponent', () => {
  let fixture: ComponentFixture<AssignmentClubIndexComponent>;
  let component: AssignmentClubIndexComponent;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AssignmentClubIndexComponent],
      imports: [CommonModule, FormsModule, getTranslocoTestingModule()],
      providers: [provideHttpClient(), provideHttpClientTesting()],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(AssignmentClubIndexComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  function flushInit(games: unknown[]) {
    fixture.detectChanges();
    httpMock
      .expectOne((r) => r.url.includes('settings/seasons'))
      .flush({
        seasons: [{ id: 17, name: '2025/2026', current: true }],
        current_season_id: 17,
      });
    httpMock
      .expectOne((r) => r.url.includes('admin/referee_assignments/games'))
      .flush(games);
  }

  it('übernimmt den Freitext eines Spiels ohne Verein in die Zeile', () => {
    flushInit([
      {
        id: 1,
        league_id: 5,
        nominated_referee_string: 'Müller / Schmidt',
        assignment_club_id: null,
      },
    ]);
    httpMock.expectOne((r) => r.url.includes('league_clubs')).flush([]);

    expect(component.rowStates[1].freeText).toBe('Müller / Schmidt');
    expect(component.rowStates[1].clubId).toBeNull();
  });

  // Steht ein Verein, gehört der Text ihm. Stünde er zusätzlich im Freitextfeld,
  // schriebe das nächste Speichern ihn als Freitext zurück und löschte damit die
  // Verknüpfung, an der die spätere Selbstbenennung durch den Verein hängt.
  it('laesst das Freitextfeld leer, wenn ein Verein angesetzt ist', () => {
    flushInit([
      {
        id: 2,
        league_id: 5,
        nominated_referee_string: 'SV Musterstadt',
        assignment_club_id: 42,
      },
    ]);
    httpMock.expectOne((r) => r.url.includes('league_clubs')).flush([]);

    expect(component.rowStates[2].clubId).toBe(42);
    expect(component.rowStates[2].freeText).toBe('');
  });

  it('speichert den Verein und schliesst den Freitext aus', () => {
    flushInit([{ id: 3, league_id: 5, nominated_referee_string: '' }]);
    httpMock.expectOne((r) => r.url.includes('league_clubs')).flush([]);

    component.rowStates[3].clubId = 7;
    component.onClubChange(component.games[0]);
    component.save(component.games[0]);

    const req = httpMock.expectOne(
      environment.apiURL + 'admin/referee_assignments/games/3/club_assignment'
    );
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ club_id: 7 });
    req.flush({
      game_id: 3,
      nominated_referee_string: 'SV Musterstadt',
      assignment_club_id: 7,
    });

    expect(component.games[0].assignment_club_id).toBe(7);
  });

  it('speichert den Freitext und loest den Verein', () => {
    flushInit([
      {
        id: 4,
        league_id: 5,
        nominated_referee_string: '',
        assignment_club_id: 9,
      },
    ]);
    httpMock.expectOne((r) => r.url.includes('league_clubs')).flush([]);

    component.rowStates[4].freeText = 'Meier / Krause';
    component.onFreeTextChange(component.games[0]);
    expect(component.rowStates[4].clubId).toBeNull();

    component.save(component.games[0]);
    const req = httpMock.expectOne(
      environment.apiURL + 'admin/referee_assignments/games/4/club_assignment'
    );
    expect(req.request.body).toEqual({
      nominated_referee_string: 'Meier / Krause',
    });
    req.flush({
      game_id: 4,
      nominated_referee_string: 'Meier / Krause',
      assignment_club_id: null,
    });

    expect(component.games[0].assignment_club_id).toBeNull();
  });

  // Die RSK arbeitet eine Liga Spieltag für Spieltag ab. Ohne Vorauswahl und
  // Gruppierung stünde sie wieder vor einer ligaübergreifenden Datumsliste.
  it('waehlt die erste Liga vor und gruppiert deren Spiele nach Spieltag', () => {
    flushInit([
      {
        id: 1,
        league_id: 5,
        league: 'A-Liga',
        game_day_id: 11,
        game_day_number: 1,
        date: '2026-09-12',
      },
      {
        id: 2,
        league_id: 5,
        league: 'A-Liga',
        game_day_id: 11,
        game_day_number: 1,
        date: '2026-09-12',
      },
      {
        id: 3,
        league_id: 5,
        league: 'A-Liga',
        game_day_id: 12,
        game_day_number: 2,
        date: '2026-09-26',
      },
      {
        id: 4,
        league_id: 6,
        league: 'B-Liga',
        game_day_id: 21,
        game_day_number: 1,
        date: '2026-09-05',
      },
    ]);
    // Vereine werden nur für die angezeigte Liga geholt, nicht für jede geladene.
    const clubRequests = httpMock.match((r) => r.url.includes('league_clubs'));
    expect(clubRequests.length).toBe(1);
    clubRequests[0].flush([]);

    expect(component.selectedLeagueId).toBe(5);
    expect(component.leagues.map((l) => l.name)).toEqual(['A-Liga', 'B-Liga']);
    expect(component.groups.map((g) => g.key)).toEqual(['gd-11', 'gd-12']);
    expect(component.groups[0].games.map((g) => g.id)).toEqual([1, 2]);
    // Erster Aufbau: alle Spieltage offen.
    expect(component.openGameDays).toEqual(['gd-11', 'gd-12']);

    // Einmal mit Daten rendern: die Gruppierung steckt im Template, ein Fehler
    // dort fiele sonst erst im Browser auf.
    fixture.detectChanges();
    const headers: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button[aria-expanded]')
    );
    expect(headers.length).toBe(2);
    expect(headers[0].textContent).toContain('12.09.2026');
  });

  it('zeigt nach dem Ligawechsel nur die Spieltage der neuen Liga', () => {
    flushInit([
      { id: 1, league_id: 5, league: 'A-Liga', game_day_id: 11 },
      { id: 2, league_id: 6, league: 'B-Liga', game_day_id: 21 },
    ]);
    httpMock.expectOne((r) => r.url.includes('league_clubs')).flush([]);

    component.selectedLeagueId = 6;
    component.onLeagueChange();
    httpMock.expectOne((r) => r.url.includes('league_clubs')).flush([]);

    expect(component.groups.map((g) => g.key)).toEqual(['gd-21']);
    expect(component.groups[0].games.map((g) => g.id)).toEqual([2]);
  });

  // Gesperrte Spiele pflegt die Ansetzer*in personenscharf. Zählten sie mit,
  // bliebe der Spieltag im Kopf ewig unvollständig.
  it('zaehlt gesperrte Spiele nicht in den Spieltags-Fortschritt', () => {
    flushInit([
      { id: 1, league_id: 5, game_day_id: 11, assignment_club_id: 7 },
      { id: 2, league_id: 5, game_day_id: 11, nominated_referee_string: '' },
      {
        id: 3,
        league_id: 5,
        game_day_id: 11,
        locked: true,
        nominated_referee_string: 'Meier / Krause',
      },
    ]);
    httpMock.expectOne((r) => r.url.includes('league_clubs')).flush([]);

    const group = component.groups[0];
    expect(group.games.length).toBe(3);
    expect(component.assignableCount(group)).toBe(2);
    expect(component.assignedCount(group)).toBe(1);
  });

  // Zwei Spieltage derselben Liga können auf denselben Tag fallen – über das
  // Datum gruppiert wären sie ein Block.
  it('trennt zwei Spieltage am selben Datum', () => {
    flushInit([
      {
        id: 1,
        league_id: 5,
        game_day_id: 11,
        game_day_number: 1,
        date: '2026-09-12',
      },
      {
        id: 2,
        league_id: 5,
        game_day_id: 12,
        game_day_number: 2,
        date: '2026-09-12',
      },
    ]);
    httpMock.expectOne((r) => r.url.includes('league_clubs')).flush([]);

    expect(component.groups.length).toBe(2);
  });

  afterEach(() => httpMock.verify());
});
