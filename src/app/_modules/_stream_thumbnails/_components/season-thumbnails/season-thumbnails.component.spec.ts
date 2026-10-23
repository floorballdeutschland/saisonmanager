import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { GameService } from '@floorball/core';
import { SeasonThumbnailGame, SeasonThumbnailPayload } from '@floorball/types';
import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';
import { StreamThumbnailsModule } from '../../stream-thumbnails.module';
import { SeasonThumbnailsComponent } from './season-thumbnails.component';

import de from 'src/assets/i18n/stream-thumbnails/de.json';

describe('SeasonThumbnailsComponent', () => {
  let fixture: ComponentFixture<SeasonThumbnailsComponent>;
  let component: SeasonThumbnailsComponent;
  let gameService: jasmine.SpyObj<GameService>;

  function game(
    id: number,
    overrides: Partial<SeasonThumbnailGame> = {}
  ): SeasonThumbnailGame {
    return {
      id,
      game_number: String(id),
      start_time: '14:00',
      home_team_name: 'Heim',
      guest_team_name: 'Gast',
      home_team_logo: null,
      guest_team_logo: null,
      ended: false,
      result: null,
      ...overrides,
    };
  }

  const ended = (id: number) =>
    game(id, {
      ended: true,
      result: { home_goals: 2, guest_goals: 1, postfix: { short: '' } },
    });

  function payload(
    overrides: Partial<SeasonThumbnailPayload> = {}
  ): SeasonThumbnailPayload {
    return {
      season_id: 18,
      seasons: [
        { id: 18, name: '2026/2027' },
        { id: 17, name: '2025/2026' },
      ],
      game_days: [
        {
          id: 1,
          number: 1,
          date: '2026-09-20',
          league_id: 10,
          league: 'Regionalliga',
          arena: { name: 'Halle Nord' },
          games: [ended(1), game(2)],
        },
        {
          id: 2,
          number: 2,
          date: '2026-10-04',
          league_id: 20,
          league: 'U17',
          arena: { name: 'Halle Nord' },
          games: [ended(3)],
        },
      ],
      ...overrides,
    };
  }

  beforeEach(async () => {
    gameService = jasmine.createSpyObj('GameService', [
      'getSeasonThumbnailGameDays',
    ]);
    gameService.getSeasonThumbnailGameDays.and.returnValue(of(payload()));

    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        StreamThumbnailsModule,
        getTranslocoTestingModule({ 'stream-thumbnails/de': de }),
      ],
      providers: [{ provide: GameService, useValue: gameService }],
    }).compileComponents();

    fixture = TestBed.createComponent(SeasonThumbnailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('lädt die aktuelle Saison und teilt die Spiele nach Bildaufbau', () => {
    expect(gameService.getSeasonThumbnailGameDays).toHaveBeenCalledWith(null);
    expect(component.livestreamItems.length).toBe(3);
    expect(component.highlightItems.map((item) => item.variant)).toEqual([
      'highlights',
      'highlights',
    ]);
    expect(
      component.livestreamItems.every((item) => item.variant === 'livestream')
    ).toBeTrue();
    expect(text()).toContain(
      '2 Spieltage mit 3 Spielen, davon 2 mit Endstand.'
    );
    expect(text()).toContain('Livestream-Thumbnails (3)');
    expect(text()).toContain('Highlight-Thumbnails (2)');
  });

  it('lädt beim Saisonwechsel die gewählte Saison', () => {
    component.selectSeason('17');

    expect(gameService.getSeasonThumbnailGameDays).toHaveBeenCalledWith(17);
  });

  it('filtert nach Liga, ohne neu zu laden', () => {
    component.selectLeague('20');

    expect(gameService.getSeasonThumbnailGameDays).toHaveBeenCalledTimes(1);
    expect(component.livestreamItems.length).toBe(1);
    expect(component.zipName('highlights')).toBe(
      'thumbnails-highlights-2026-2027-u17'
    );
  });

  it('benennt das Archiv nach Saison und Bildaufbau', () => {
    expect(component.zipName('livestream')).toBe(
      'thumbnails-livestream-2026-2027'
    );
  });

  it('sagt es, wenn der Verein in der Saison nicht ausrichtet', () => {
    gameService.getSeasonThumbnailGameDays.and.returnValue(
      of(payload({ game_days: [] }))
    );
    component.selectSeason(17);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-test="season-empty"]')
    ).not.toBeNull();
  });

  // Ohne den Zustand behauptete die Karte „keine Spieltage", obwohl sie es
  // gar nicht weiß.
  it('zeigt einen Ladefehler als solchen', () => {
    gameService.getSeasonThumbnailGameDays.and.returnValue(
      throwError(() => new Error('weg'))
    );
    component.selectSeason(17);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-test="season-failed"]')
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-test="season-empty"]')
    ).toBeNull();
  });
});
