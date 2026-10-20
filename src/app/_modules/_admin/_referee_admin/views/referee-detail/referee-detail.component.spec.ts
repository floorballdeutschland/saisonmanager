import { Component, Input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
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
  RefereeCourseResultSummary,
  RefereeObservation,
  RefereeObservationAdminResponse,
  User,
} from '@floorball/types';

import { TabDirective } from 'src/app/_modules/_uikit/_common/components/molecules/tabs/tab.directive';
import { TabsComponent } from 'src/app/_modules/_uikit/_common/components/molecules/tabs/tabs.component';

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

const courseResult: RefereeCourseResultSummary = {
  id: 31,
  lizenzstufe: 'L2',
  gueltigkeit: '30.09.2028',
  kursstichtag: '15.08.2026',
  status: 'applied',
  applied_at: '2026-08-20T10:00:00Z',
  rejection_reason: null,
  course_data: {
    kurs_1: {
      stufe: 'L2',
      datum: '15.08.2026',
      testversion: 'B',
      punkte: '27',
    },
    kurs_2: { stufe: null, datum: null, testversion: null, punkte: null },
    ausbilder: 'Max Lehrer',
  },
};

describe('RefereeDetailComponent', () => {
  let fixture: ComponentFixture<RefereeDetailComponent>;
  let adminGetCourses: jasmine.Spy;
  let adminGetFeedbacks: jasmine.Spy;
  let adminGetForReferee: jasmine.Spy;
  let adminGetRefereeClubExclusions: jasmine.Spy;
  let coursesResponse: Observable<RefereeCourseResultSummary[]>;

  beforeEach(() => {
    coursesResponse = of([courseResult]);
  });

  async function setUp(
    games: RefereeAdminGame[],
    permissions: Record<string, boolean> = { menu_item_referee_admin: true },
    refereeOverrides: Partial<RefereeAdmin> = {},
    reiter: string | null = null
  ) {
    const shown = { ...referee, ...refereeOverrides } as RefereeAdmin;
    adminGetCourses = jasmine
      .createSpy('adminGetCourses')
      .and.callFake(() => coursesResponse);
    adminGetFeedbacks = jasmine.createSpy('adminGetFeedbacks').and.returnValue(
      of({
        summary: {
          count: 0,
          avg_line_rating: null,
          avg_communication_rating: null,
        },
      })
    );
    adminGetForReferee = jasmine
      .createSpy('adminGetForReferee')
      .and.returnValue(of(observationResponse));
    adminGetRefereeClubExclusions = jasmine
      .createSpy('adminGetRefereeClubExclusions')
      .and.returnValue(
        of({ club_exclusions: [], club_exclusion_requests: [] })
      );
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
                courseHistory: 'Kurshistorie',
                noCourses: 'Keine eingereichten Kursergebnisse.',
                coursesLoadFailed: 'Kurshistorie nicht verfügbar.',
                exclusionsHeading: 'Vereins-Ausschlüsse',
                feedbackHeading: 'Schiri-Feedback der Vereine',
                coursePoints: '{{points}} Punkte',
                courseTestVersion: 'Testversion {{version}}',
                openMatch: 'Zum Spiel / Spielbericht',
                phone: 'Telefon',
                shortNotice: 'Kurzfristig mobil',
                shortNoticeNoPhone: 'Ja, aber ohne hinterlegte Telefonnummer',
              },
            },
          },
        }),
      ],
      declarations: [
        RefereeDetailComponent,
        ObservationDetailStubComponent,
        TabsComponent,
        TabDirective,
      ],
      providers: [
        {
          provide: RefereeService,
          useValue: {
            adminGetAll: () => of([shown]),
            adminGetById: () => of(shown),
            adminGetGames: () => of(games),
            adminGetCourses,
            adminGetFeedbacks,
            adminGetRefereeClubExclusions,
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
            adminGetForReferee,
            adminSetStatus: () => of(null),
          },
        },
        { provide: NotificationService, useValue: { error: () => undefined } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { params: { lizenznummer: '4711' } },
            // Die Reiterleiste liest den aktiven Reiter aus ?reiter=.
            queryParamMap: new BehaviorSubject(
              convertToParamMap(reiter ? { reiter } : {})
            ),
          },
        },
      ],
    }).compileComponents();

    // Der Reiterwechsel schreibt ?reiter= in die URL; die Route hier ist ein
    // Stub ohne Platz im Routenbaum, also die Navigation selbst abfangen.
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(RefereeDetailComponent);
    fixture.detectChanges();
  }

  const tabIds = (): string[] =>
    Array.from(
      fixture.nativeElement.querySelectorAll(
        '[role="tab"]'
      ) as NodeListOf<HTMLElement>
    ).map((el) => (el.getAttribute('data-testid') ?? '').replace('tab-', ''));

  function openTab(id: string): void {
    (
      fixture.nativeElement.querySelector(
        `[data-testid="tab-${id}"]`
      ) as HTMLButtonElement
    ).click();
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
    openTab('spiele');

    const links = gameLinks();
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/sbk-ost/5/spiel/7',
      '/sbk-ost/5/spiel/7',
    ]);
    expect(links.map((a) => a.textContent?.trim())).toEqual(['Heim', 'Gast']);
  });

  it('zeigt Mannschaften ohne Link, wenn die Liga-Angaben fehlen', async () => {
    await setUp([game({ league_id: null, game_operation_slug: null })]);
    openTab('spiele');

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
    openTab('bewertungen');

    expect(moderationButtons().filter(Boolean).length).toBe(1);
  });

  it('zeigt der Ansetzung die Bögen, aber nicht den Knopf zum Zurücknehmen', async () => {
    await setUp([], {
      menu_item_referee_admin: true,
      referee_observation_view: true,
    });
    openTab('bewertungen');

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

  // Kurshistorie: nur mit eigenem Recht. Der Vereinsmanager sieht das Profil,
  // die API verweigert ihm die Kursergebnisse aber mit 403.
  const headings = (): string[] =>
    Array.from(
      fixture.nativeElement.querySelectorAll('h2') as NodeListOf<HTMLElement>
    ).map((h) => h.textContent?.trim() ?? '');

  it('zeigt die Kurshistorie im eigenen Reiter und laedt sie erst dort', async () => {
    await setUp([], {
      menu_item_referee_admin: true,
      referee_course_history_view: true,
      menu_item_referee_exclusions: true,
    });

    expect(adminGetCourses).not.toHaveBeenCalled();
    openTab('kurse');

    expect(adminGetCourses).toHaveBeenCalledWith(referee.id);
    expect(headings()).toEqual(['Kurshistorie']);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('L2, 15.08.2026, Testversion B, 27 Punkte');
    expect(text).toContain('Max Lehrer');
  });

  it('laedt die Kurshistorie ohne das Recht gar nicht erst', async () => {
    await setUp([], { menu_item_referee_admin: true }, {}, 'kurse');

    expect(adminGetCourses).not.toHaveBeenCalled();
    expect(tabIds()).not.toContain('kurse');
    expect(headings()).not.toContain('Kurshistorie');
  });

  // Mischrolle VM + LV-RSK: Profil ja, Kurse 403. Dann nicht „keine Kurse"
  // behaupten, sondern sagen, dass sie hier nicht abrufbar sind.
  it('meldet einen gescheiterten Abruf statt einer leeren Kurshistorie', async () => {
    coursesResponse = throwError(() => ({ status: 403 }));
    await setUp([], {
      menu_item_referee_admin: true,
      referee_course_history_view: true,
    });
    openTab('kurse');

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Kurshistorie nicht verfügbar.');
    expect(text).not.toContain('Keine eingereichten Kursergebnisse.');
  });

  // Reiter: Übersicht ist der Standard, die übrigen hängen an denselben
  // Rechten wie vorher die Abschnitte.
  describe('Reiter', () => {
    const allRights = {
      menu_item_referee_admin: true,
      referee_course_history_view: true,
      referee_feedback_view: true,
      referee_observation_view: true,
      menu_item_referee_exclusions: true,
    };

    it('oeffnet die Uebersicht als Standard und rendert die Spiele nicht', async () => {
      await setUp([game()], allRights, { strasse: 'Musterweg 1' });

      expect(tabIds()).toEqual([
        'uebersicht',
        'spiele',
        'kurse',
        'bewertungen',
        'ausschluesse',
      ]);
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('Musterweg 1');
      expect(headings()).not.toContain('Spielhistorie');
    });

    it('oeffnet den Reiter aus der URL', async () => {
      await setUp([game()], allRights, {}, 'spiele');

      expect(headings()).toEqual(['Spielhistorie']);
      expect(gameLinks().length).toBe(2);
    });

    it('zeigt die Anzahl der Spiele am Reiter', async () => {
      await setUp([game(), game({ id: 8 })]);

      const badge = fixture.nativeElement.querySelector(
        '[data-testid="tab-spiele"] span'
      ) as HTMLElement;
      expect(badge.textContent?.trim()).toBe('2');
    });

    it('laesst die gegateten Reiter ohne Rechte weg', async () => {
      await setUp([]);

      expect(tabIds()).toEqual(['uebersicht', 'spiele']);
      expect(adminGetFeedbacks).not.toHaveBeenCalled();
      expect(adminGetForReferee).not.toHaveBeenCalled();
      expect(adminGetRefereeClubExclusions).not.toHaveBeenCalled();
    });

    it('laedt Feedback und Beobachtungen erst beim Oeffnen ihres Reiters', async () => {
      await setUp([], allRights);

      expect(adminGetFeedbacks).not.toHaveBeenCalled();
      expect(adminGetForReferee).not.toHaveBeenCalled();
      openTab('bewertungen');

      expect(adminGetFeedbacks).toHaveBeenCalledOnceWith(referee.id);
      expect(adminGetForReferee).toHaveBeenCalledOnceWith(referee.id);
      expect(headings()[0]).toBe('Schiri-Feedback der Vereine');

      // Zurück und wieder hin lädt nicht erneut.
      openTab('uebersicht');
      openTab('bewertungen');
      expect(adminGetFeedbacks).toHaveBeenCalledTimes(1);
      expect(adminGetForReferee).toHaveBeenCalledTimes(1);
    });

    it('zeigt im Bewertungsreiter nur die Beobachtungen, wenn das Feedback-Recht fehlt', async () => {
      await setUp(
        [],
        { menu_item_referee_admin: true, referee_observation_view: true },
        {},
        'bewertungen'
      );

      expect(adminGetFeedbacks).not.toHaveBeenCalled();
      expect(headings()).not.toContain('Schiri-Feedback der Vereine');
      expect(
        fixture.nativeElement.querySelectorAll('fb-referee-observation-detail')
          .length
      ).toBe(1);
    });

    it('laedt die Ausschlussliste einmal beim ersten Oeffnen', async () => {
      await setUp([], allRights);

      expect(adminGetRefereeClubExclusions).not.toHaveBeenCalled();
      openTab('ausschluesse');
      openTab('uebersicht');
      openTab('ausschluesse');

      expect(adminGetRefereeClubExclusions).toHaveBeenCalledOnceWith(
        referee.id
      );
      expect(headings()).toEqual(['Vereins-Ausschlüsse']);
    });
  });
});
