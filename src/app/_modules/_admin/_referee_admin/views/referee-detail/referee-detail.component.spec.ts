import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { Observable, of } from 'rxjs';
import {
  NotificationService,
  RefereeService,
  SessionService,
} from '@floorball/core';
import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';
import { RefereeAdmin, RefereeAdminGame, User } from '@floorball/types';

import { RefereeDetailComponent } from './referee-detail.component';

const referee = {
  id: 12,
  lizenznummer: 4711,
  lizenznummer_display: '4711',
  vorname: 'Ida',
  nachname: 'Muster',
  guest: false,
} as RefereeAdmin;

const game = (overrides: Partial<RefereeAdminGame> = {}): RefereeAdminGame =>
  ({
    id: 7,
    game_number: '10',
    date: '2026-09-01',
    home_team: 'Heim',
    guest_team: 'Gast',
    league: 'Regionalliga',
    league_id: 5,
    game_operation_slug: 'sbk-ost',
    season_id: 18,
    ...overrides,
  }) as RefereeAdminGame;

describe('RefereeDetailComponent', () => {
  let fixture: ComponentFixture<RefereeDetailComponent>;

  async function setUp(games: RefereeAdminGame[]) {
    await TestBed.configureTestingModule({
      imports: [
        FormsModule,
        RouterTestingModule,
        // Die Übersetzungen stehen global unter dem Alias, nicht als
        // Scope-Schlüssel: Die Komponente steht hier ohne ihr Modul und damit
        // ohne dessen TRANSLOCO_SCOPE.
        getTranslocoTestingModule({
          de: {
            refereeAdmin: {
              detail: {
                gameHistory: 'Spielhistorie',
                openMatch: 'Zum Spiel / Spielbericht',
              },
            },
          },
        }),
      ],
      declarations: [RefereeDetailComponent],
      providers: [
        {
          provide: RefereeService,
          useValue: {
            adminGetAll: () => of([referee]),
            adminGetById: () => of(referee),
            adminGetGames: () => of(games),
          },
        },
        {
          provide: SessionService,
          useValue: {
            // RSK-Sicht: Zugriff auf den Schiedsrichter, aber ohne Feedback und
            // ohne Ausschlussliste – die beiden Blöcke laden dann nicht.
            currentUser$: of({
              permissions: { menu_item_referee_admin: true },
            } as unknown as User) as Observable<User | null>,
          },
        },
        { provide: NotificationService, useValue: { error: () => undefined } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { params: { lizenznummer: '4711' } } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RefereeDetailComponent);
    fixture.detectChanges();
  }

  const gameLinks = (): HTMLAnchorElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('tbody a[href]'));

  it('verlinkt das Spiel über Verband-Slug und Liga-ID', async () => {
    await setUp([]);

    expect(fixture.componentInstance.matchLink(game())).toEqual([
      '/',
      'sbk-ost',
      5,
      'spiel',
      7,
    ]);
  });

  it('verlinkt nicht, wenn Verband-Slug oder Liga-ID fehlen', async () => {
    await setUp([]);

    const link = fixture.componentInstance.matchLink.bind(
      fixture.componentInstance
    );
    expect(link(game({ game_operation_slug: null }))).toBeNull();
    expect(link(game({ league_id: null }))).toBeNull();
  });

  // Mit echtem Template: matchLink allein zu prüfen würde nicht auffallen, wenn
  // die Tabelle den Link gar nicht setzt oder Heim und Gast vertauscht.
  it('verlinkt Heim- und Gastname der Spielhistorie auf die Spielseite', async () => {
    await setUp([game()]);

    const links = gameLinks();
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/sbk-ost/5/spiel/7',
      '/sbk-ost/5/spiel/7',
    ]);
    expect(links.map((a) => a.textContent?.trim())).toEqual(['Heim', 'Gast']);
  });

  it('zeigt Mannschaften ohne Link, wenn die Liga-Angaben fehlen', async () => {
    await setUp([game({ league_id: null, game_operation_slug: null })]);

    expect(gameLinks().length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('Heim');
    expect(fixture.nativeElement.textContent).toContain('Gast');
  });
});
