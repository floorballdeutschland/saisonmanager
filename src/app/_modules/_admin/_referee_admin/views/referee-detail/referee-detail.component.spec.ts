import { Component, Input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { Observable, of } from 'rxjs';
import {
  NotificationService,
  RefereeObservationService,
  RefereeService,
  SessionService,
} from '@floorball/core';
import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';
import {
  RefereeAdmin,
  RefereeAdminGame,
  RefereeObservation,
  RefereeObservationAdminResponse,
  User,
} from '@floorball/types';

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

// Der Bogen selbst wird an anderer Stelle geprüft; hier zählt nur, ob die Maske
// den Knopf zum Zurücknehmen danebenstellt.
@Component({
  selector: 'fb-referee-observation-detail',
  template: '',
  standalone: false,
})
class ObservationDetailStubComponent {
  @Input() observation!: RefereeObservation;
}

const observationResponse: RefereeObservationAdminResponse = {
  summary: {
    count: 1,
    stick_play_rating: 5,
    physical_play_rating: 5,
    penalty_line_rating: 5,
    game_management_rating: 5,
    overall_rating: 5,
  },
  observations: [{ id: 3, status: 'visible' } as RefereeObservation],
};

describe('RefereeDetailComponent', () => {
  let fixture: ComponentFixture<RefereeDetailComponent>;

  async function setUp(
    games: RefereeAdminGame[],
    permissions: Record<string, boolean> = { menu_item_referee_admin: true },
    refereeOverrides: Partial<RefereeAdmin> = {}
  ) {
    const shown = { ...referee, ...refereeOverrides } as RefereeAdmin;
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
                phone: 'Telefon',
                shortNotice: 'Kurzfristig mobil',
                shortNoticeNoPhone: 'Ja, aber ohne hinterlegte Telefonnummer',
              },
            },
          },
        }),
      ],
      declarations: [RefereeDetailComponent, ObservationDetailStubComponent],
      providers: [
        {
          provide: RefereeService,
          useValue: {
            adminGetAll: () => of([shown]),
            adminGetById: () => of(shown),
            adminGetGames: () => of(games),
          },
        },
        {
          provide: SessionService,
          useValue: {
            // Voreinstellung ist die RSK-Sicht: Zugriff auf den Schiedsrichter,
            // aber ohne Feedback und ohne Ausschlussliste – die beiden Blöcke
            // laden dann nicht.
            currentUser$: of({
              permissions,
            } as unknown as User) as Observable<User | null>,
          },
        },
        {
          provide: RefereeObservationService,
          useValue: {
            adminGetForReferee: () => of(observationResponse),
            adminSetStatus: () => of(null),
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

  // Lesen und Zurücknehmen sind zwei Rechte. Die Ansetzung sieht die Bögen,
  // darf sie aber nicht zurücknehmen; hinge der Knopf am Leserecht, liefe ihr
  // Klick in eine Absage der API.
  const moderationButtons = (): HTMLButtonElement[] =>
    Array.from(
      fixture.nativeElement.querySelectorAll('fb-referee-observation-detail')
    ).map((el) =>
      (el as HTMLElement).parentElement?.querySelector('button')
    ) as HTMLButtonElement[];

  it('zeigt den Knopf zum Zurücknehmen nur mit dem Moderationsrecht', async () => {
    await setUp([], {
      menu_item_referee_admin: true,
      referee_observation_view: true,
      referee_observation_moderate: true,
    });

    expect(moderationButtons().filter(Boolean).length).toBe(1);
  });

  it('zeigt der Ansetzung die Bögen, aber nicht den Knopf zum Zurücknehmen', async () => {
    await setUp([], {
      menu_item_referee_admin: true,
      referee_observation_view: true,
    });

    expect(
      fixture.nativeElement.querySelectorAll('fb-referee-observation-detail')
        .length
    ).toBe(1);
    expect(moderationButtons().filter(Boolean).length).toBe(0);
  });

  // Die Nummer steht im Profilabschnitt „Ansetzungsinformationen" und ist fuer
  // die Ansetzung gedacht. Sie stand bisher in keiner Antwort der Verwaltung.
  const phoneLink = (): HTMLAnchorElement | null =>
    fixture.nativeElement.querySelector('a[href^="tel:"]');

  it('verlinkt die Telefonnummer waehlbar', async () => {
    await setUp(
      [],
      { menu_item_referee_admin: true },
      {
        telefonnummer: '0170 1234567',
      }
    );

    // Waehlziel ohne Leerzeichen, Anzeige mit -- ein rohes "tel:0170 1234567"
    // ist kein gueltiger URI.
    expect(phoneLink()?.getAttribute('href')).toBe('tel:01701234567');
    expect(phoneLink()?.textContent?.trim()).toBe('0170 1234567');
  });

  // Der fuer die Ansetzung einzig interessante Fall: erreichbar UND kurzfristig
  // verfuegbar. Beide Bindungen sitzen im selben Block, aber getrennt.
  it('zeigt Nummer und Kennzeichen zusammen', async () => {
    await setUp(
      [],
      { menu_item_referee_admin: true },
      { telefonnummer: '0170 1234567', kurzfristig_mobil: true }
    );

    expect(phoneLink()?.textContent?.trim()).toBe('0170 1234567');
    expect(fixture.nativeElement.textContent).toContain('Kurzfristig mobil');
  });

  // Eine Nummer aus lauter Leerzeichen ergaebe sonst eine Ueberschrift
  // „Telefon" ueber einer leeren Zeile mit totem Link. Weder das Profil noch
  // das Modell schneidet die Eingabe ab.
  it('behandelt eine Nummer aus Leerzeichen wie keine Nummer', async () => {
    await setUp(
      [],
      { menu_item_referee_admin: true },
      { telefonnummer: '   ', strasse: 'Musterweg 1' }
    );

    expect(phoneLink()).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Telefon');
  });

  // Ohne Nummer darf kein leerer tel:-Link entstehen; das Kennzeichen allein
  // bleibt aber sichtbar, sonst faellt der Hinweis „kurzfristig mobil" weg.
  it('zeigt das Kennzeichen auch ohne hinterlegte Nummer', async () => {
    await setUp(
      [],
      { menu_item_referee_admin: true },
      {
        kurzfristig_mobil: true,
      }
    );

    expect(phoneLink()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'Ja, aber ohne hinterlegte Telefonnummer'
    );
  });

  // Gegenprobe zur Zweckbindung: Liefert die API die Felder nicht mit (etwa dem
  // Vereinsmanager), steht weder Nummer noch Kennzeichen in der Maske. Die
  // Adresse ist gesetzt, damit der umgebende Block wirklich gerendert wird --
  // sonst bewiese der Test nur, dass eine leere Maske leer ist.
  it('zeigt nichts, wenn die API die Ansetzungsdaten nicht mitliefert', async () => {
    await setUp(
      [],
      { menu_item_referee_admin: true },
      { strasse: 'Musterweg 1' }
    );

    expect(fixture.nativeElement.textContent).toContain('Musterweg 1');
    expect(phoneLink()).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain(
      'Kurzfristig mobil'
    );
  });
});
