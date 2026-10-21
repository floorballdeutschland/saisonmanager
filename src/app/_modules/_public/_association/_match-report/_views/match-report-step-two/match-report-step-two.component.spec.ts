import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { getTranslocoTestingModule } from '@floorball/core';
import { GameTimelineFilterPipe } from 'src/app/_helpers/_pipes/game-timeline-filter.pipe';

import {
  MatchReportStepTwoComponent,
  TABLET_MODE_STORAGE_KEY,
  TABLET_NORMAL_INPUT_STORAGE_KEY,
} from './match-report-step-two.component';
import { Game, GameAdditionalFields } from '@floorball/types';

// Ein Spiel, das startbereit ist: Kader auf beiden Seiten, Schiedsrichter 1
// gesetzt. Die Tests nehmen davon jeweils genau ein Teil weg.
function startableGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 1,
    players: { home: [{ id: 1 }], guest: [{ id: 2 }] },
    referee1_present: true,
    referees: [
      { license_id: '5605', first_name: 'Tobias', last_name: 'Schröder' },
    ],
    period_titles: [],
    ...overrides,
  } as unknown as Game;
}

describe('MatchReportStepTwoComponent', () => {
  let component: MatchReportStepTwoComponent;
  let fixture: ComponentFixture<MatchReportStepTwoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, getTranslocoTestingModule()],
      declarations: [MatchReportStepTwoComponent, GameTimelineFilterPipe],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(MatchReportStepTwoComponent);
    component = fixture.componentInstance;
    component.additionalFields = {} as GameAdditionalFields;
  });

  describe('Gate vor dem Spielstart', () => {
    it('gibt den Start frei, wenn Kader und Schiedsrichter 1 stehen', () => {
      component.game = startableGame();

      expect(component.bothLineupsPresent()).toBeTrue();
      expect(component.referee1Present()).toBeTrue();
      expect(component.onlyReferee2Present()).toBeFalse();
    });

    it('sperrt den Start, solange Schiedsrichter 1 fehlt', () => {
      component.game = startableGame({
        referee1_present: false,
        referees: [],
      });

      expect(component.referee1Present()).toBeFalse();
      // Kein Schiedsrichter überhaupt -- der allgemeine Hinweis, nicht der
      // Umtragen-Hinweis.
      expect(component.onlyReferee2Present()).toBeFalse();
    });

    // Der Fall aus Wernigerode am 30.08.2026: Das Gespann war eingetragen, nur
    // auf Platz 2. Hier braucht es den Hinweis, dass die Platznummer gemeint ist.
    it('erkennt das Gespann im falschen Feld', () => {
      component.game = startableGame({
        referee1_present: false,
        referees: [
          { license_id: '5824', first_name: 'Max', last_name: 'Trosien' },
        ],
      });

      expect(component.referee1Present()).toBeFalse();
      expect(component.onlyReferee2Present()).toBeTrue();
    });

    // Ein geleertes Feld hinterlässt serverseitig den Platzhalter "0 , ", der in
    // `referees` als Eintrag mit Lizenz "0" und leerem Namen mitläuft. Er darf
    // nicht als eingetragener Schiedsrichter durchgehen, sonst zeigt die Maske
    // den Umtragen-Hinweis, obwohl gar niemand eingetragen ist.
    it('zaehlt den leeren Platzhalter nicht als Schiedsrichter', () => {
      component.game = startableGame({
        referee1_present: false,
        referees: [{ license_id: '0', first_name: '', last_name: '' }],
      });

      expect(component.onlyReferee2Present()).toBeFalse();
    });

    // Frontend und API werden getrennt ausgerollt. Fehlt das Feld, darf das Gate
    // nicht sperren -- sonst wäre der Spielstart nach einem Frontend-Deploy
    // ueberhaupt nicht mehr erreichbar.
    it('laesst durch, wenn die API das Flag noch nicht liefert', () => {
      component.game = startableGame({ referee1_present: undefined });

      expect(component.referee1Present()).toBeTrue();
      expect(component.onlyReferee2Present()).toBeFalse();
    });

    it('sperrt weiterhin bei unvollstaendigem Kader', () => {
      component.game = startableGame({
        players: { home: [{ id: 1 }], guest: [] },
      } as unknown as Partial<Game>);

      expect(component.bothLineupsPresent()).toBeFalse();
    });
  });

  // Die Hilfsmethoden oben allein sagen nichts darüber, ob der Knopf wirklich
  // verschwindet. Genau darauf kommt es an: Angeboten und erst am Klick
  // abgewiesen zu werden, war der Fehler.
  describe('Maske', () => {
    function render(game: Game): HTMLElement {
      component.game = game;
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    const startForm = (dom: HTMLElement) =>
      dom.querySelector('fb-match-event-form[type="start"]');

    it('zeigt den Startknopf, wenn Kader und Schiedsrichter 1 stehen', () => {
      const dom = render(startableGame());

      expect(startForm(dom)).toBeTruthy();
      expect(dom.textContent).not.toContain('Schiedsrichter 1 fehlt');
    });

    it('nimmt den Startknopf weg, solange Schiedsrichter 1 fehlt', () => {
      const dom = render(
        startableGame({ referee1_present: false, referees: [] })
      );

      expect(startForm(dom)).toBeNull();
      expect(dom.textContent).toContain('Schiedsrichter 1 fehlt');
      expect(dom.textContent).toContain('Schiedsrichter 2 bleibt optional');
    });

    it('sagt beim Gespann im falschen Feld, dass umgetragen werden muss', () => {
      const dom = render(
        startableGame({
          referee1_present: false,
          referees: [
            { license_id: '5824', first_name: 'Max', last_name: 'Trosien' },
          ],
        })
      );

      expect(startForm(dom)).toBeNull();
      expect(dom.textContent).toContain('nur „Schiedsrichter 2" eingetragen');
      expect(dom.textContent).toContain('umtragen');
    });

    // Der Kader-Hinweis ist der ältere und kommt zuerst: Ohne Kader ist die
    // Schiedsrichter-Frage noch gar nicht die nächste Aufgabe.
    it('zeigt bei fehlendem Kader weiter den Kader-Hinweis', () => {
      const dom = render(
        startableGame({
          referee1_present: false,
          players: { home: [], guest: [] },
        } as unknown as Partial<Game>)
      );

      expect(startForm(dom)).toBeNull();
      expect(dom.textContent).toContain('Kader unvollständig');
      expect(dom.textContent).not.toContain('Schiedsrichter 1 fehlt');
    });
  });

  // Tabletmodus (Beta, fe#344): Der Schalter ist das einzige, was sich an der
  // gewohnten Eingabe ändert. Schritt 2 rendert nur für Bearbeitungsberechtigte
  // (MatchReportComponent#canEditGame), der Schalter steht also für genau die.
  describe('Tabletmodus', () => {
    afterEach(() => {
      localStorage.removeItem(TABLET_MODE_STORAGE_KEY);
      localStorage.removeItem(TABLET_NORMAL_INPUT_STORAGE_KEY);
    });

    function render(game: Game): HTMLElement {
      component.game = game;
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    const toggle = (dom: HTMLElement) =>
      dom.querySelector(
        '[data-testid="tablet-mode-toggle"]'
      ) as HTMLInputElement | null;

    it('zeigt den Schalter vor und nach dem Anpfiff', () => {
      expect(toggle(render(startableGame()))).not.toBeNull();
    });

    it('zeigt ohne Schalter keine Erfassung', () => {
      const dom = render(startableGame({ started: true }));

      expect(toggle(dom)!.checked).toBeFalse();
      expect(dom.querySelector('fb-tablet-capture')).toBeNull();
      expect(
        dom.querySelector('[data-testid="tablet-not-started"]')
      ).toBeNull();
    });

    it('blendet die Erfassung nach dem Einschalten ein und merkt sich das je Gerät', () => {
      const dom = render(startableGame({ started: true }));

      const input = toggle(dom)!;
      input.checked = true;
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(dom.querySelector('fb-tablet-capture')).not.toBeNull();
      expect(localStorage.getItem(TABLET_MODE_STORAGE_KEY)).toBe('1');
      // Die gewohnte Eingabe klappt dabei ein.
      expect(dom.querySelector('fb-match-event-button')).toBeNull();
    });

    it('liest den gemerkten Zustand beim Öffnen', () => {
      localStorage.setItem(TABLET_MODE_STORAGE_KEY, '1');
      const dom = render(startableGame({ started: true }));

      expect(toggle(dom)!.checked).toBeTrue();
      expect(dom.querySelector('fb-tablet-capture')).not.toBeNull();

      component.setTabletMode(false);
      expect(localStorage.getItem(TABLET_MODE_STORAGE_KEY)).toBeNull();
    });
    describe('normale Eingabe', () => {
      const normalToggle = (dom: HTMLElement) =>
        dom.querySelector(
          '[data-testid="tablet-normal-input-toggle"]'
        ) as HTMLButtonElement | null;

      const normalInputParts = (dom: HTMLElement) => ({
        events: dom.querySelector('[data-testid="normal-input-events"]'),
        more: dom.querySelector('[data-testid="normal-input-more"]'),
        awards: dom.querySelector('fb-awards'),
        next: dom.querySelector('fb-button'),
      });

      it('bleibt ohne Tabletmodus unverändert und ohne Umschalter', () => {
        localStorage.setItem(TABLET_NORMAL_INPUT_STORAGE_KEY, '1');
        const dom = render(startableGame({ started: true }));

        expect(normalToggle(dom)).toBeNull();
        const parts = normalInputParts(dom);
        expect(parts.events).not.toBeNull();
        expect(parts.more).not.toBeNull();
        expect(parts.awards).not.toBeNull();
        expect(parts.next).not.toBeNull();
        expect(dom.querySelectorAll('fb-match-event-button').length).toBe(6);
      });

      it('ist im Tabletmodus eingeklappt, Erfassung und Zeitleiste bleiben', () => {
        localStorage.setItem(TABLET_MODE_STORAGE_KEY, '1');
        const dom = render(startableGame({ started: true }));

        const parts = normalInputParts(dom);
        expect(parts.events).toBeNull();
        expect(parts.more).toBeNull();
        expect(parts.awards).toBeNull();
        expect(parts.next).toBeNull();
        expect(dom.querySelector('fb-match-event-form')).toBeNull();
        expect(dom.querySelector('fb-tablet-capture')).not.toBeNull();
        expect(dom.querySelector('nav[aria-label="Progress"]')).not.toBeNull();
        expect(normalToggle(dom)!.getAttribute('aria-expanded')).toBe('false');
      });

      it('klappt per Umschalter auf und merkt sich das je Gerät', () => {
        localStorage.setItem(TABLET_MODE_STORAGE_KEY, '1');
        const dom = render(startableGame({ started: true }));

        normalToggle(dom)!.click();
        fixture.detectChanges();

        expect(localStorage.getItem(TABLET_NORMAL_INPUT_STORAGE_KEY)).toBe('1');
        expect(normalInputParts(dom).events).not.toBeNull();
        expect(normalToggle(dom)!.getAttribute('aria-expanded')).toBe('true');

        component.setEvent('goal-home');
        fixture.detectChanges();
        expect(dom.querySelector('fb-match-event-form')).not.toBeNull();

        normalToggle(dom)!.click();
        fixture.detectChanges();
        expect(
          localStorage.getItem(TABLET_NORMAL_INPUT_STORAGE_KEY)
        ).toBeNull();
        expect(normalInputParts(dom).events).toBeNull();
        // Ein offenes Formular steht beim nächsten Aufklappen nicht wieder da.
        expect(component.event).toBe('');
      });

      it('liest den aufgeklappten Zustand beim Öffnen', () => {
        localStorage.setItem(TABLET_MODE_STORAGE_KEY, '1');
        localStorage.setItem(TABLET_NORMAL_INPUT_STORAGE_KEY, '1');
        const dom = render(startableGame({ started: true }));

        expect(normalInputParts(dom).events).not.toBeNull();
        expect(dom.querySelector('fb-tablet-capture')).not.toBeNull();
      });

      it('klappt vor dem Anpfiff auch den Startknopf ein', () => {
        localStorage.setItem(TABLET_MODE_STORAGE_KEY, '1');
        const dom = render(startableGame());

        expect(
          dom.querySelector('fb-match-event-form[type="start"]')
        ).toBeNull();
        expect(
          dom.querySelector('[data-testid="tablet-not-started"]')
        ).not.toBeNull();

        normalToggle(dom)!.click();
        fixture.detectChanges();
        expect(
          dom.querySelector('fb-match-event-form[type="start"]')
        ).not.toBeNull();
      });
    });
  });
});
