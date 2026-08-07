import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { GameService, NotificationService } from '@floorball/core';
import { SecretaryHallDay } from '@floorball/types';

import { SecretaryLinksComponent } from './secretary-links.component';

describe('SecretaryLinksComponent', () => {
  let component: SecretaryLinksComponent;
  let fixture: ComponentFixture<SecretaryLinksComponent>;
  let gameService: jasmine.SpyObj<GameService>;
  let notificationService: jasmine.SpyObj<NotificationService>;

  const hallDay = (overrides: Partial<SecretaryHallDay> = {}) =>
    ({
      arena_id: 5,
      arena: 'Sporthalle Nord',
      date: '2026-01-10',
      game_days: [
        { id: 1, date: '2026-01-10', league: 'U15', games_count: 3 },
        { id: 2, date: '2026-01-10', league: 'U17', games_count: 2 },
      ],
      other_game_days_in_hall: [],
      link: null,
      ...overrides,
    }) as SecretaryHallDay;

  beforeEach(async () => {
    gameService = jasmine.createSpyObj('GameService', [
      'getSecretaryGameDays',
      'createSecretaryLink',
    ]);
    notificationService = jasmine.createSpyObj('NotificationService', [
      'error',
      'success',
    ]);
    gameService.getSecretaryGameDays.and.returnValue(of([hallDay()]));

    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [SecretaryLinksComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: GameService, useValue: gameService },
        { provide: NotificationService, useValue: notificationService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SecretaryLinksComponent);
    component = fixture.componentInstance;
  });

  it('lädt die Spieltage und zählt die Spiele der ganzen Halle', () => {
    component.ngOnInit();

    expect(component.loading).toBe(false);
    expect(component.hallDays.length).toBe(1);
    expect(component.gamesCount(component.hallDays[0])).toBe(5);
    expect(component.leagueNames(component.hallDays[0])).toBe('U15 · U17');
  });

  // Der Link wird immer für den ersten Spieltag angefordert; welche weiteren er
  // abdeckt, entscheidet der Server anhand Halle, Datum und Berechtigung.
  it('fordert den Link für den ersten Spieltag der Gruppe an', () => {
    gameService.createSecretaryLink.and.returnValue(
      of({
        url: 'https://example.test/spielsekretariat?token=abc',
        token: 'abc',
        expires_at: '2026-01-13T12:00:00Z',
        created_by: 'Max Mustermann',
        game_day_id: 1,
        game_day_ids: [1, 2],
        game_days: [],
      })
    );
    component.ngOnInit();
    const group = component.hallDays[0];

    component.generate(group);

    expect(gameService.createSecretaryLink).toHaveBeenCalledWith(1);
    expect(component.urlByKey[component.key(group)]).toBe(
      'https://example.test/spielsekretariat?token=abc'
    );
    expect(group.link?.game_day_ids).toEqual([1, 2]);
    expect(component.generatingKey).toBeNull();
  });

  it('meldet einen Fehler beim Erzeugen und blockiert nicht dauerhaft', () => {
    gameService.createSecretaryLink.and.returnValue(
      throwError(() => new Error('boom'))
    );
    component.ngOnInit();

    component.generate(component.hallDays[0]);

    expect(notificationService.error).toHaveBeenCalled();
    expect(component.generatingKey).toBeNull();
  });

  it('meldet einen Fehler beim Laden', () => {
    gameService.getSecretaryGameDays.and.returnValue(
      throwError(() => new Error('boom'))
    );

    component.ngOnInit();

    expect(component.loading).toBe(false);
    expect(notificationService.error).toHaveBeenCalled();
  });

  // Ohne Halle bildet ein Spieltag eine eigene Gruppe – der Schlüssel darf sich
  // dann nicht mit einer anderen hallenlosen Gruppe desselben Tages decken.
  it('unterscheidet hallenlose Gruppen am selben Tag', () => {
    const a = hallDay({
      arena_id: null,
      arena: undefined,
      game_days: [{ id: 8, date: '2026-01-10', league: 'U9', games_count: 1 }],
    });
    const b = hallDay({
      arena_id: null,
      arena: undefined,
      game_days: [{ id: 9, date: '2026-01-10', league: 'U11', games_count: 1 }],
    });

    expect(component.key(a)).not.toBe(component.key(b));
  });
});
