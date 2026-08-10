import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { LiveStreamService } from '@floorball/core';
import { LiveStreamGame } from '@floorball/types';
import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';
import { LiveComponent } from './live.component';

describe('LiveComponent', () => {
  let fixture: ComponentFixture<LiveComponent>;
  let component: LiveComponent;
  let serviceSpy: jasmine.SpyObj<LiveStreamService>;

  function game(overrides: Partial<LiveStreamGame>): LiveStreamGame {
    return {
      game_id: 1,
      game_number: '1',
      date: '2026-08-10',
      time: '18:00',
      status: 'upcoming',
      started: false,
      ended: false,
      current_period_title: null,
      league: { id: 5, name: '1. Bundesliga Herren', short_name: '1BL' },
      arena_name: 'Sporthalle',
      hosting_club: 'SV Muster',
      home_team_id: 1,
      home_team_name: 'Heim',
      home_team_logo: null,
      home_team_small_logo: null,
      guest_team_id: 2,
      guest_team_name: 'Gast',
      guest_team_logo: null,
      guest_team_small_logo: null,
      live_stream_link: 'https://stream.example/live',
      vod_link: null,
      ...overrides,
    };
  }

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj<LiveStreamService>('LiveStreamService', [
      'getToday',
    ]);

    await TestBed.configureTestingModule({
      declarations: [LiveComponent],
      imports: [getTranslocoTestingModule()],
      providers: [{ provide: LiveStreamService, useValue: serviceSpy }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  function create(): void {
    fixture = TestBed.createComponent(LiveComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('teilt die Spiele in laufende, anstehende und beendete auf', () => {
    serviceSpy.getToday.and.returnValue(
      of({
        date: '2026-08-10',
        games: [
          game({ game_id: 1, status: 'running', started: true }),
          game({ game_id: 2, status: 'upcoming' }),
          game({ game_id: 3, status: 'ended', started: true, ended: true }),
        ],
      })
    );

    create();

    expect(component.running.map((g) => g.game_id)).toEqual([1]);
    expect(component.upcoming.map((g) => g.game_id)).toEqual([2]);
    expect(component.ended.map((g) => g.game_id)).toEqual([3]);
    expect(component.isEmpty).toBeFalse();
  });

  it('meldet einen leeren Tag als leer und nicht als Fehler', () => {
    serviceSpy.getToday.and.returnValue(of({ date: '2026-08-10', games: [] }));

    create();

    expect(component.isEmpty).toBeTrue();
    expect(component.failed).toBeFalse();
  });

  it('zeigt beim ersten Fehlversuch einen Hinweis', () => {
    serviceSpy.getToday.and.returnValue(throwError(() => new Error('kaputt')));

    create();

    expect(component.failed).toBeTrue();
    expect(component.loading).toBeFalse();
  });

  // Ein Aussetzer beim Nachladen darf eine bereits stehende Liste nicht gegen
  // eine Fehlermeldung tauschen: Auf einem Hallenmonitor stünde dort sonst nach
  // einem einzelnen Netzhänger für den Rest des Abends „konnte nicht geladen
  // werden".
  it('behaelt die Liste, wenn erst das Nachladen scheitert', () => {
    serviceSpy.getToday.and.returnValue(
      of({
        date: '2026-08-10',
        games: [game({ game_id: 1, status: 'running', started: true })],
      })
    );
    create();

    serviceSpy.getToday.and.returnValue(throwError(() => new Error('kaputt')));
    component.load();

    expect(component.failed).toBeFalse();
    expect(component.running.length).toBe(1);
  });

  // Ohne Zwischenstand bleibt das Feld leer. Ein ausgewiesenes 0:0 wäre bei
  // einer laufenden Partie, deren Stand zurückgehalten wird, eine Falschaussage.
  it('gibt ohne Ergebnis keinen Stand aus', () => {
    serviceSpy.getToday.and.returnValue(of({ date: '2026-08-10', games: [] }));
    create();

    expect(component.score(game({ result_string: null }))).toBe('');
    expect(component.score(game({ result_string: '3:1' }))).toBe('3:1');
  });
});
