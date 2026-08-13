import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
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
      imports: [FormsModule, getTranslocoTestingModule()],
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

  afterEach(() => httpMock.verify());
});
