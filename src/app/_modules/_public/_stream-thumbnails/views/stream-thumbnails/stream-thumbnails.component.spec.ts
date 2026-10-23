import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { GameService } from '@floorball/core';
import { StreamThumbnailsModule } from '@floorball/stream-thumbnails';
import { OverlayGameDayPayload } from '@floorball/types';
import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';
import { StreamThumbnailsComponent } from './stream-thumbnails.component';

import de from 'src/assets/i18n/stream-thumbnails/de.json';

describe('StreamThumbnailsComponent', () => {
  let fixture: ComponentFixture<StreamThumbnailsComponent>;
  let component: StreamThumbnailsComponent;
  let gameService: jasmine.SpyObj<GameService>;
  let token: string | null;

  const payload: OverlayGameDayPayload = {
    game_day: {
      id: 7,
      date: '2026-10-24',
      number: 5,
      league: 'Regionalliga Ost',
      league_id: 42,
      arena: 'Halle Nord',
    },
    games: [
      {
        id: 1,
        game_number: '1',
        start_time: '12:00',
        home_team: 'Heim',
        guest_team: 'Gast',
        started: true,
        ended: true,
        game_status: 'closed',
        home_team_logo: '/api/storage/heim.png',
        guest_team_logo: null,
        result: { home_goals: 5, guest_goals: 2, postfix: { short: '' } },
      },
      {
        id: 2,
        game_number: '2',
        start_time: '14:00',
        home_team: 'Zwei',
        guest_team: null,
        started: false,
        ended: false,
        game_status: 'scheduled',
        result: null,
      },
    ],
    valid_from: '2026-10-21T00:00:00Z',
    expires_at: '2026-10-25T22:59:59Z',
  };

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        StreamThumbnailsModule,
        getTranslocoTestingModule({ 'stream-thumbnails/de': de }),
      ],
      declarations: [StreamThumbnailsComponent],
      providers: [
        { provide: GameService, useValue: gameService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap(token ? { token } : {}),
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StreamThumbnailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    token = 'abc';
    gameService = jasmine.createSpyObj('GameService', ['getOverlayGameDay']);
    gameService.getOverlayGameDay.and.returnValue(of(payload));
  });

  function query(selector: string): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(selector);
  }

  it('lädt die Spiele über das Token und baut je Spiel die Bilder', async () => {
    await create();

    expect(gameService.getOverlayGameDay).toHaveBeenCalledWith('abc');
    expect(component.state).toBe('ready');
    expect(component.rows.length).toBe(2);

    const [first, second] = component.rows;
    expect(first.livestream[0].variant).toBe('livestream');
    expect(first.livestream[0].game.home_team_logo).toBe(
      '/api/storage/heim.png'
    );
    expect(first.livestream[0].gameDay).toEqual({
      number: 5,
      date: '2026-10-24',
      league_id: 42,
      arena: { name: 'Halle Nord' },
    });
    expect(first.highlights[0].variant).toBe('highlights');
    // Vor dem Schlusspfiff kein Highlight-Bild: Es zeigte „VS" statt Endstand.
    expect(second.highlights).toEqual([]);
    expect(second.livestream[0].game.guest_team_name).toBe('');

    expect(component.allLivestream.length).toBe(2);
    expect(component.allHighlights.length).toBe(1);
    expect(query('[data-test="game-day-head"]')?.textContent).toContain(
      'Regionalliga Ost'
    );
    expect(fixture.nativeElement.textContent).toContain('Sa. 24.10.2026');
    expect(fixture.nativeElement.textContent).toContain('Zwei – N.N.');
    expect(
      fixture.nativeElement.querySelectorAll('[data-test="game-row"]').length
    ).toBe(2);
  });

  it('benennt die Archive nach Liga und Spieltag', async () => {
    await create();

    expect(component.zipName('highlights')).toBe(
      'thumbnails-highlights-regionalliga-ost-spieltag-5-2026-10-24'
    );
  });

  it('fragt ohne Token gar nicht erst', async () => {
    token = null;
    await create();

    expect(gameService.getOverlayGameDay).not.toHaveBeenCalled();
    expect(query('[data-test="state-no-token"]')).not.toBeNull();
  });

  it('nennt einen abgelaufenen Zugang und verweist auf den Saisonstapel', async () => {
    gameService.getOverlayGameDay.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 410 }))
    );
    await create();

    expect(component.state).toBe('expired');
    expect(query('[data-test="state-expired"]')?.textContent).toContain(
      'Spielsekretariat'
    );
  });

  it('zeigt bei einem noch nicht gültigen Zugang die Begründung des Servers', async () => {
    gameService.getOverlayGameDay.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 403,
            error: { message: 'Gilt ab Mittwoch.' },
          })
      )
    );
    await create();

    expect(query('[data-test="state-not-started"]')?.textContent).toContain(
      'Gilt ab Mittwoch.'
    );
  });

  it('meldet andere Fehler als Ladefehler', async () => {
    gameService.getOverlayGameDay.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 500 }))
    );
    await create();

    expect(query('[data-test="state-failed"]')).not.toBeNull();
  });
});
