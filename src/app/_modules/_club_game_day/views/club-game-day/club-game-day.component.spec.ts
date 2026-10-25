import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
  Router,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { getTranslocoTestingModule, SessionService } from '@floorball/core';
import { UikitCommonModule } from '@floorball/uikit/common';
import { clubGameDayRoutes } from '../../club-game-day-routing.module';
import { ClubGameDayComponent } from './club-game-day.component';

describe('ClubGameDayComponent', () => {
  // Die Reiterinhalte sind die frueheren Einzelseiten mit eigenen Abrufen;
  // hier geht es nur um die Auswahl der Reiter, die Inhalte bleiben deshalb
  // unbekannte Elemente.
  async function render(
    permissions: Record<string, boolean>,
    reiter: string | null = null
  ): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [UikitCommonModule, getTranslocoTestingModule()],
      declarations: [ClubGameDayComponent],
      providers: [
        provideRouter([]),
        {
          provide: SessionService,
          useValue: { currentUserValue: { permissions } },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap(reiter ? { reiter } : {}),
            },
            queryParamMap: {
              subscribe: (fn: (p: unknown) => void) => {
                fn(convertToParamMap(reiter ? { reiter } : {}));
                return { unsubscribe: () => undefined };
              },
            },
          },
        },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    const fixture = TestBed.createComponent(ClubGameDayComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const tabIds = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('[role="tab"]')).map((b) =>
      b.getAttribute('data-testid')
    );

  it('zeigt einem Verein mit allen Aufgaben drei Reiter in Spieltagsreihenfolge', async () => {
    const el = await render({
      page_secretary_links: true,
      page_team_game_days: true,
      menu_item_team_game_days: true,
      menu_item_referee_feedback: true,
    });

    expect(tabIds(el)).toEqual([
      'tab-sekretariat',
      'tab-auswaerts',
      'tab-schiri-feedback',
    ]);
    expect(el.querySelector('fb-secretary-links')).not.toBeNull();
  });

  // Wie bisher der Menuepunkt: ohne Spieltagsbericht und ohne
  // feedbackpflichtige Liga gibt es nur den Sekretariats-Zugang.
  it('laesst Reiter ohne Aufgabe weg', async () => {
    const el = await render({
      page_secretary_links: true,
      page_team_game_days: true,
    });

    expect(tabIds(el)).toEqual(['tab-sekretariat']);
  });

  // Der Link aus der Mail fuehrt ueber ?reiter=auswaerts hierher. Fehlt der
  // Menueschluessel nur, weil die erste Frage nach der Anmeldung angelegt
  // wurde, muss der Reiter trotzdem da sein.
  it('zeigt die Auswaertsspieltage beim Aufruf aus der Mail auch ohne Menueschluessel', async () => {
    const el = await render(
      { page_secretary_links: true, page_team_game_days: true },
      'auswaerts'
    );

    expect(tabIds(el)).toEqual(['tab-sekretariat', 'tab-auswaerts']);
    expect(el.querySelector('fb-team-game-days')).not.toBeNull();
  });
});

// Die alten Adressen stehen in Lesezeichen und in Mails der API und muessen
// auf den passenden Reiter fuehren.
describe('ClubGameDay-Routen', () => {
  @Component({ template: '', standalone: false })
  class LeereSeite {}

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [LeereSeite],
      providers: [
        provideRouter(
          clubGameDayRoutes.map((route) =>
            route.component ? { ...route, component: LeereSeite } : route
          )
        ),
      ],
    });
  });

  for (const [alt, neu] of [
    ['/verein/spielsekretariat', '/verein/spieltag'],
    ['/verein/spieltage', '/verein/spieltag?reiter=auswaerts'],
    ['/verein/schiri-feedback', '/verein/spieltag?reiter=schiri-feedback'],
  ]) {
    it(`leitet ${alt} auf ${neu} weiter`, async () => {
      await RouterTestingHarness.create(alt);
      expect(TestBed.inject(Router).url).toBe(neu);
    });
  }
});
