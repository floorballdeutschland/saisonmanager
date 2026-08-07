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
      arena_city: 'Teststadt',
      date: '2026-01-10',
      game_days: [
        {
          id: 1,
          number: 1,
          date: '2026-01-10',
          league: 'U15',
          league_id: 10,
          games_count: 3,
        },
        {
          id: 2,
          number: 1,
          date: '2026-01-10',
          league: 'U17',
          league_id: 20,
          games_count: 2,
        },
      ],
      other_game_days_in_hall: [],
      link: null,
      ...overrides,
    }) as SecretaryHallDay;

  const createResponse = {
    url: 'https://example.test/spielsekretariat?token=abc',
    token: 'abc',
    expires_at: '2026-01-13T12:00:00Z',
    created_by: 'Max Mustermann',
    game_day_id: 1,
    game_day_ids: [1, 2],
    game_days: [],
  };

  beforeEach(async () => {
    gameService = jasmine.createSpyObj('GameService', [
      'getSecretaryGameDays',
      'createSecretaryLink',
    ]);
    notificationService = jasmine.createSpyObj('NotificationService', [
      'error',
      'success',
      'warning',
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
    gameService.createSecretaryLink.and.returnValue(of(createResponse));
    component.ngOnInit();
    const group = component.hallDays[0];

    component.generate(group);

    expect(gameService.createSecretaryLink).toHaveBeenCalledWith(1);
    expect(component.urlByKey[component.key(group)]).toBe(
      'https://example.test/spielsekretariat?token=abc'
    );
    expect(component.linkFor(group)?.game_day_ids).toEqual([1, 2]);
    expect(component.generatingKey).toBeNull();
  });

  it('lässt die Serverantwort unangetastet und überlagert sie nur lokal', () => {
    gameService.createSecretaryLink.and.returnValue(of(createResponse));
    component.ngOnInit();
    const group = component.hallDays[0];

    component.generate(group);

    expect(group.link).toBeNull();
    expect(component.linkFor(group)?.expires_at).toBe('2026-01-13T12:00:00Z');
  });

  // Den Toast setzt der ErrorInterceptor mit der Servermeldung. Ein zweiter aus
  // der Komponente trüge dieselbe ID und verdeckte die genauere Meldung (fe#229).
  it('blockiert nach einem Fehler nicht dauerhaft und toastet nicht selbst', () => {
    gameService.createSecretaryLink.and.returnValue(
      throwError(() => ({ error: { error: 'Nicht berechtigt.' } }))
    );
    component.ngOnInit();

    component.generate(component.hallDays[0]);

    expect(component.generatingKey).toBeNull();
    expect(notificationService.error).not.toHaveBeenCalled();
  });

  // Ohne loadFailed behauptete die Seite „Keine Spieltage gefunden" – eine
  // Tatsachenbehauptung, die sie nach einem Fehler gar nicht treffen kann.
  it('unterscheidet einen Ladefehler von einer leeren Liste', () => {
    gameService.getSecretaryGameDays.and.returnValue(
      throwError(() => new Error('boom'))
    );

    component.ngOnInit();
    fixture.detectChanges();

    expect(component.loading).toBe(false);
    expect(component.loadFailed).toBe(true);
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('konnten nicht geladen werden');
    expect(text).not.toContain('Keine Spieltage gefunden');
  });

  it('warnt, wenn der Link weniger abdeckt als angezeigt', () => {
    gameService.createSecretaryLink.and.returnValue(
      of({ ...createResponse, game_day_ids: [1] })
    );
    component.ngOnInit();

    component.generate(component.hallDays[0]);

    expect(notificationService.warning).toHaveBeenCalled();
  });

  it('warnt nicht, wenn der Link alles abdeckt', () => {
    gameService.createSecretaryLink.and.returnValue(of(createResponse));
    component.ngOnInit();

    component.generate(component.hallDays[0]);

    expect(notificationService.warning).not.toHaveBeenCalled();
  });

  // Ohne Halle bildet ein Spieltag eine eigene Gruppe – der Schlüssel darf sich
  // dann nicht mit einer anderen hallenlosen Gruppe desselben Tages decken.
  it('unterscheidet hallenlose Gruppen am selben Tag', () => {
    const a = hallDay({
      arena_id: null,
      arena: null,
      arena_city: null,
      game_days: [
        {
          id: 8,
          number: 1,
          date: '2026-01-10',
          league: 'U9',
          league_id: 1,
          games_count: 1,
        },
      ],
    } as Partial<SecretaryHallDay>);
    const b = hallDay({
      arena_id: null,
      arena: null,
      arena_city: null,
      game_days: [
        {
          id: 9,
          number: 1,
          date: '2026-01-10',
          league: 'U11',
          league_id: 2,
          games_count: 1,
        },
      ],
    } as Partial<SecretaryHallDay>);

    expect(component.key(a)).not.toBe(component.key(b));
  });

  describe('copy', () => {
    beforeEach(() => {
      gameService.createSecretaryLink.and.returnValue(of(createResponse));
      component.ngOnInit();
      component.generate(component.hallDays[0]);
    });

    it('meldet Kopiert, wenn die Zwischenablage den Text angenommen hat', async () => {
      spyOn(navigator.clipboard, 'writeText').and.resolveTo();

      await component.copy(component.hallDays[0]);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'https://example.test/spielsekretariat?token=abc'
      );
      expect(component.copiedKey).toBe(component.key(component.hallDays[0]));
    });

    // Sonst liest der Button "Kopiert", während die Zwischenablage leer blieb,
    // und der Link gilt als verschickt.
    it('meldet nicht Kopiert, wenn die Zwischenablage ablehnt', async () => {
      spyOn(navigator.clipboard, 'writeText').and.rejectWith(
        new Error('denied')
      );

      await component.copy(component.hallDays[0]);

      expect(component.copiedKey).toBeNull();
      expect(notificationService.error).toHaveBeenCalled();
    });

    it('eine Neuausgabe setzt die Kopiert-Meldung zurück', async () => {
      spyOn(navigator.clipboard, 'writeText').and.resolveTo();
      await component.copy(component.hallDays[0]);

      component.generate(component.hallDays[0]);

      expect(component.copiedKey).toBeNull();
    });
  });

  describe('Darstellung', () => {
    it('nennt die fremde Belegung der Halle beim Namen', () => {
      gameService.getSecretaryGameDays.and.returnValue(
        of([
          hallDay({
            other_game_days_in_hall: [
              {
                id: 7,
                number: 1,
                date: '2026-01-10',
                league: 'Bezirksliga',
                league_id: 30,
                games_count: 2,
              },
            ],
          }),
        ])
      );

      fixture.detectChanges();

      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('Bezirksliga');
      expect(text).toContain('im Link nicht enthalten');
    });

    // Ein Spieltag ausserhalb des Fensters fehlt kommentarlos in der Liste. Der
    // Zeitraum muss deshalb dranstehen, sonst liest sich das Fehlen als Fehler.
    it('nennt den gezeigten Zeitraum', () => {
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain(
        'der nächsten 60 Tage'
      );
    });

    it('nennt den Zeitraum auch, wenn nichts gefunden wurde', () => {
      gameService.getSecretaryGameDays.and.returnValue(of([]));

      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain(
        'In den nächsten 60 Tagen gibt es keinen Spieltag'
      );
    });

    it('zeigt den Kopieren-Button erst nach dem Erzeugen', () => {
      gameService.createSecretaryLink.and.returnValue(of(createResponse));
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).not.toContain('Link kopieren');

      component.generate(component.hallDays[0]);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Link kopieren');
    });
  });
});
