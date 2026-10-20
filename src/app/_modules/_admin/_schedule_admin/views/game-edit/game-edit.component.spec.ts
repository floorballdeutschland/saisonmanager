import { GameService, getTranslocoTestingModule } from '@floorball/core';
import { Game } from '@floorball/types';
import { of, Subject } from 'rxjs';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameEditComponent } from './game-edit.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { UikitCommonModule } from '@floorball/uikit/common';

describe('GameEditComponent', () => {
  let component: GameEditComponent;
  let fixture: ComponentFixture<GameEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      // FormsModule und die echten UIKit-Bausteine, damit das Formular wie in
      // der App absendet: ohne NgForm gibt es kein ngSubmit, und die Tests zum
      // Doppelabsenden (#577) liefen ins Leere.
      imports: [
        getTranslocoTestingModule(),
        HttpClientTestingModule,
        FormsModule,
        UikitCommonModule,
      ],
      declarations: [GameEditComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GameEditComponent);
    component = fixture.componentInstance;
    // Die Elternansicht liefert die Mannschaften immer mit; fb-select-search
    // setzt eine Liste voraus.
    component.teams = [];
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // newGame() läuft im Konstruktor, der Input kommt asynchron aus
  // additional_references. Würde die Voreinstellung nur dort gelesen, bliebe die
  // Markierung immer aus – und weil die Maske das Feld beim Speichern trotzdem
  // mitschickt, käme auch die serverseitige Voreinstellung nicht zum Zug.
  it('übernimmt die Verbands-Voreinstellung, wenn der Input nachträglich eintrifft', () => {
    expect(component.game.person_level_assignment).toBe(false);

    component.personLevelAssignmentDefault = true;
    component.ngOnChanges();

    expect(component.game.person_level_assignment).toBe(true);
  });

  it('überschreibt eine von Hand entfernte Markierung nicht', () => {
    component.personLevelAssignmentDefault = true;
    component.ngOnChanges();
    expect(component.game.person_level_assignment).toBe(true);

    component.togglePersonLevelAssignment();
    expect(component.game.person_level_assignment).toBe(false);

    // Erneutes Eintreffen der Inputs darf die Entscheidung nicht zurückdrehen.
    component.ngOnChanges();
    expect(component.game.person_level_assignment).toBe(false);
  });

  // Die Felder sind bewusst `null` und nicht 0, wenn nichts festgesetzt ist:
  // 0 waere ein ausdrueckliches 0:0 und wuerde die Liga-Vorgabe stillschweigend
  // ueberschreiben.
  it('uebernimmt ein festgesetztes Forfait-Ergebnis aus dem Spiel', () => {
    component.existingGame = {
      id: 7,
      forfait: 1,
      forfait_home_goals: 2,
      forfait_guest_goals: 9,
    } as unknown as typeof component.existingGame;

    component.resetGame();

    expect(component.forfaitHomeGoals).toBe(2);
    expect(component.forfaitGuestGoals).toBe(9);
    expect(component.hasForfaitResultChanges).toBe(false);
  });

  it('laesst die Torfelder leer, wenn nichts festgesetzt ist', () => {
    component.existingGame = {
      id: 7,
      forfait: 1,
    } as unknown as typeof component.existingGame;

    component.resetGame();

    expect(component.forfaitHomeGoals).toBeNull();
    expect(component.forfaitGuestGoals).toBeNull();
  });

  // Ein halbes Ergebnis weist die API ab. Die Maske muss es vorher sagen, sonst
  // laeuft die Eingabe in eine Fehlermeldung ohne Bezug.
  it('erkennt ein halbes Forfait-Ergebnis', () => {
    component.forfaitHomeGoals = 3;
    component.forfaitGuestGoals = null;

    expect(component.forfaitResultIncomplete).toBe(true);

    component.forfaitGuestGoals = 0;

    expect(component.forfaitResultIncomplete).toBe(false);
  });

  // Der Hinweis nennt, was ohne Eintrag gewertet wuerde. Bei beidseitiger
  // Wertung sind das negative Tore -- die Vorgabe belastet dort das
  // Torverhaeltnis.
  it('zeigt die Liga-Vorgabe passend zur Wertung', () => {
    component.existingGame = {
      id: 7,
      forfait: 1,
      forfait_default_goals: 8,
    } as unknown as typeof component.existingGame;
    expect(component.forfaitDefaultResult).toBe('0:8');

    component.existingGame = {
      id: 7,
      forfait: 2,
      forfait_default_goals: 5,
    } as unknown as typeof component.existingGame;
    expect(component.forfaitDefaultResult).toBe('5:0');

    component.existingGame = {
      id: 7,
      forfait: 3,
      forfait_default_goals: 8,
    } as unknown as typeof component.existingGame;
    expect(component.forfaitDefaultResult).toBe('-8:-8');
  });

  // Zwischen Frontend- und API-Deploy fehlt das Feld. Dann lieber keinen
  // Hinweis als eine erfundene Zahl.
  it('laesst den Hinweis weg, solange die API die Vorgabe nicht liefert', () => {
    component.existingGame = {
      id: 7,
      forfait: 1,
    } as unknown as typeof component.existingGame;

    expect(component.forfaitDefaultResult).toBeNull();
  });

  // api#738: Vor der Wertung wurden started/ended ueber set_flag geschickt. Dort
  // haengt an started die Startpruefung des Spielberichts -- Aufstellung beider
  // Mannschaften und Schiedsrichter 1 -- die ein kampflos gewertetes Spiel nie
  // erfuellt. Die Wertung war damit ueberhaupt nicht setzbar. Die Marken setzt
  // jetzt die API zusammen mit der Wertung.
  it('setzt die Wertung ohne den Umweg ueber die Spielmarken', () => {
    const gameService = TestBed.inject(GameService);
    const rating = spyOn(gameService, 'updateGameRating').and.returnValue(
      of({ success: true })
    );
    const flags = spyOn(gameService, 'setGameFlags');
    // Bewusst verschiedene IDs: die Wertung haengt an `game.id`. Waeren beide
    // gleich, bliebe der Test auch dann gruen, wenn jemand auf `existingGame`
    // zurueckbaut.
    component.game.id = 7;
    component.existingGame = {
      id: 99,
      forfait: 0,
    } as unknown as typeof component.existingGame;

    component.setRatingMode('forfait-home');

    expect(rating).toHaveBeenCalledWith(7, 1);
    expect(flags).not.toHaveBeenCalled();
  });

  // Die Gegenrichtung: Genau hier tat der alte set_flag-Aufruf tatsaechlich
  // etwas, er setzte started/ended bedingungslos auf false. Das entscheidet
  // jetzt die API, die die Marken nur ohne Ereignisse und ohne Aufstellung
  // raeumt -- ein wirklich gespieltes Spiel behaelt sein Ergebnis.
  it('nimmt die Wertung ebenfalls ohne Spielmarken zurueck', () => {
    const gameService = TestBed.inject(GameService);
    const rating = spyOn(gameService, 'updateGameRating').and.returnValue(
      of({ success: true })
    );
    const flags = spyOn(gameService, 'setGameFlags');
    component.game.id = 7;
    component.existingGame = {
      id: 99,
      forfait: 1,
    } as unknown as typeof component.existingGame;

    component.setRatingMode('regular');

    expect(rating).toHaveBeenCalledWith(7, 0);
    expect(flags).not.toHaveBeenCalled();
  });

  it('laesst ein bestehendes Spiel unangetastet', () => {
    component.existingGame = {
      person_level_assignment: false,
    } as unknown as typeof component.existingGame;
    component.personLevelAssignmentDefault = true;

    component.ngOnChanges();

    expect(component.game.person_level_assignment).toBe(false);
  });
  describe('Aktionsmenue der Zeile', () => {
    const q = (sel: string): HTMLElement | null =>
      fixture.nativeElement.querySelector(sel);

    // Ein bestehendes, nicht begonnenes Spiel ohne Aenderungen: der Fall, in
    // dem alle Menueeintraege angeboten werden.
    const showExisting = (extra: Partial<Game> = {}, gameDays = 2) => {
      component.gameDayId = 5;
      component.allGameDays = Array.from({ length: gameDays }, (_, i) => ({
        id: i + 5,
      })) as unknown as typeof component.allGameDays;
      component.existingGame = {
        id: 7,
        forfait: 0,
        started: false,
        ...extra,
      } as unknown as Game;
      component.resetGame();
      fixture.detectChanges();
    };

    const openMenu = () => {
      q('[data-testid="game-menu-toggle"]')!.click();
      fixture.detectChanges();
    };

    const iconTitles = (): string[] =>
      Array.from(
        fixture.nativeElement.querySelectorAll(
          'button[title]'
        ) as NodeListOf<HTMLElement>
      ).map((b) => b.getAttribute('title') ?? '');

    it('ist geschlossen, bis es geoeffnet wird', () => {
      showExisting();
      expect(q('[data-testid="game-menu"]')).toBeNull();

      openMenu();

      expect(q('[data-testid="game-menu"]')).not.toBeNull();
      expect(q('[data-testid="game-menu-delete"]')).not.toBeNull();
      expect(q('[data-testid="game-menu-playoff"]')).not.toBeNull();
      expect(q('[data-testid="game-menu-move"]')).not.toBeNull();
    });

    it('zeigt Loeschen, Playoff und Spieltag nicht mehr als Symbol', () => {
      showExisting();

      const titles = iconTitles();
      expect(titles).not.toContain('scheduleAdmin.gameEdit.titleDeleteGame');
      expect(titles).not.toContain('scheduleAdmin.gameEdit.titleEditPlayoff');
      expect(titles).not.toContain('scheduleAdmin.gameEdit.titleMoveGameDay');
      expect(titles).toContain('scheduleAdmin.gameEdit.titleEditNotice');
    });

    // Ohne existingGame gibt es kein Menue. Die Playoff-Angaben muessen beim
    // Anlegen trotzdem erreichbar bleiben.
    it('laesst bei neuen Spielen das Playoff-Symbol stehen', () => {
      expect(q('[data-testid="game-menu-toggle"]')).toBeNull();
      expect(iconTitles()).toContain('scheduleAdmin.gameEdit.titleEditPlayoff');
    });

    it('schliesst sich nach der Auswahl und fuehrt die Aktion aus', () => {
      const gameService = TestBed.inject(GameService);
      const del = spyOn(gameService, 'deleteGame').and.returnValue(
        of({ success: true })
      );
      showExisting();
      openMenu();

      q('[data-testid="game-menu-delete"]')!.click();
      fixture.detectChanges();

      expect(del).toHaveBeenCalled();
      expect(component.menuOpen).toBe(false);
      expect(q('[data-testid="game-menu"]')).toBeNull();
    });

    it('schaltet die Playoff-Angaben ueber das Menue um', () => {
      showExisting();
      const before = component.hasGameDependencies;
      openMenu();

      q('[data-testid="game-menu-playoff"]')!.click();
      fixture.detectChanges();

      expect(component.hasGameDependencies).toBe(!before);
      expect(component.menuOpen).toBe(false);
    });

    it('schliesst sich beim Klick daneben', () => {
      showExisting();
      openMenu();

      q('[data-testid="game-menu-backdrop"]')!.click();
      fixture.detectChanges();

      expect(q('[data-testid="game-menu"]')).toBeNull();
    });

    // Nach dem Oeffnen liegt der Fokus auf dem Knopf, nicht im Menue. Escape
    // muss von dort aus wirken und den Fokus auf dem Knopf lassen.
    it('schliesst sich mit Escape vom Knopf aus', () => {
      showExisting();
      const toggle = q('[data-testid="game-menu-toggle"]')!;
      toggle.focus();
      openMenu();

      toggle.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      );
      fixture.detectChanges();

      expect(q('[data-testid="game-menu"]')).toBeNull();
      expect(document.activeElement).toBe(toggle);
    });

    it('bringt den Fokus nach Escape aus dem Menue auf den Knopf zurueck', () => {
      showExisting();
      openMenu();
      const entry = q('[data-testid="game-menu-playoff"]')!;
      entry.focus();

      entry.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      );
      fixture.detectChanges();

      expect(q('[data-testid="game-menu"]')).toBeNull();
      expect(document.activeElement).toBe(
        q('[data-testid="game-menu-toggle"]')
      );
    });

    it('bietet Loeschen nur ohne ungespeicherte Aenderungen an', () => {
      showExisting();
      component.game.game_number = 'geaendert';
      openMenu();

      expect(q('[data-testid="game-menu-delete"]')).toBeNull();
      expect(q('[data-testid="game-menu-playoff"]')).not.toBeNull();
    });

    it('bietet Spieltag wechseln nur bei mehreren Spieltagen an', () => {
      showExisting({}, 1);
      openMenu();

      expect(q('[data-testid="game-menu-move"]')).toBeNull();
    });

    it('zeigt bei begonnenen Spielen nur die Wertung', () => {
      showExisting({ started: true });
      openMenu();

      expect(q('[data-testid="game-menu-delete"]')).toBeNull();
      expect(q('[data-testid="game-menu-playoff"]')).toBeNull();
      expect(q('[data-testid="game-menu-move"]')).toBeNull();
      expect(q('[data-testid="game-menu"]')!.textContent).toContain(
        'scheduleAdmin.gameEdit.forfaitHome'
      );
    });
  });

  // #577: Der Anlegen-Knopf hatte (click)="createGame()" UND type="submit",
  // das Formular ruft bei ngSubmit noch einmal createGame -- jedes Spiel wurde
  // doppelt angelegt. Knoepfe ohne type sind im Formular ebenfalls submit und
  // legten bei neuen Spielen schon beim Oeffnen der Notiz ein Spiel an.
  describe('Absenden des Formulars', () => {
    let create: jasmine.Spy;
    let update: jasmine.Spy;

    beforeEach(() => {
      const gameService = TestBed.inject(GameService);
      create = spyOn(gameService, 'createGame').and.returnValue(
        of({ success: true })
      );
      update = spyOn(gameService, 'updateGame').and.returnValue(
        of({ success: true })
      );
    });

    // Enter in einem Feld loest im Browser einen Klick auf den ersten
    // Absendeknopf des Formulars aus (implizites Absenden). Ein synthetisches
    // keydown tut das nicht, und requestSubmit() klickt nichts -- beides
    // wuerde den doppelten Aufruf ueber (click) nicht zeigen.
    const pressEnter = () => {
      const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
      const defaultButton = Array.from(form.elements).find(
        (el): el is HTMLButtonElement =>
          el instanceof HTMLButtonElement && el.type === 'submit'
      );
      if (defaultButton) {
        defaultButton.click();
      } else {
        form.requestSubmit();
      }
    };

    const showExisting = ({ changed = false } = {}) => {
      component.gameDayId = 5;
      component.existingGame = {
        id: 7,
        forfait: 0,
        started: false,
      } as unknown as typeof component.existingGame;
      component.resetGame();
      if (changed) {
        component.game.game_number = 'geaendert';
      }
      fixture.detectChanges();
    };

    const button = (title: string): HTMLButtonElement =>
      fixture.nativeElement.querySelector(
        `button[title="scheduleAdmin.gameEdit.${title}"]`
      );

    it('legt per Klick auf Anlegen genau ein Spiel an', () => {
      button('titleCreateGame').click();

      expect(create).toHaveBeenCalledTimes(1);
    });

    it('legt per Enter im Formular genau ein Spiel an', () => {
      pressEnter();

      expect(create).toHaveBeenCalledTimes(1);
    });

    it('setzt die Anlegezeile nach dem Anlegen zurueck', () => {
      component.gameDayId = 5;
      component.personLevelAssignmentDefault = true;
      component.game.game_number = '42';
      component.game.start_time = '18:00';
      component.hasNotice = true;

      button('titleCreateGame').click();
      fixture.detectChanges();

      expect(component.processing).toBe(false);
      expect(component.game.game_number).toBe('');
      expect(component.game.start_time).toBe('');
      expect(component.game.game_day_id).toBe(5);
      expect(component.game.person_level_assignment).toBe(true);
      expect(component.hasNotice).toBe(false);

      // Ein zweites Spiel laesst sich ohne Neuladen anlegen.
      button('titleCreateGame').click();
      expect(create).toHaveBeenCalledTimes(2);
    });

    it('legt beim Oeffnen der Notiz kein Spiel an', () => {
      button('titleEditNotice').click();

      expect(component.hasNotice).toBe(true);
      expect(create).not.toHaveBeenCalled();
    });

    it('legt beim Oeffnen der Playoff-Angaben kein Spiel an', () => {
      button('titleEditPlayoff').click();

      expect(create).not.toHaveBeenCalled();
    });

    it('speichert beim Verwerfen nichts', () => {
      showExisting({ changed: true });

      button('titleDiscardChanges').click();

      expect(create).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    });

    it('legt waehrend einer laufenden Anlage kein zweites Spiel an', () => {
      // Antwort bleibt aus: die erste Anlage laeuft noch.
      create.and.returnValue(new Subject<{ success: boolean }>());

      component.createGame();
      component.createGame();

      expect(create).toHaveBeenCalledTimes(1);
    });

    it('speichert ein geaendertes Spiel per Klick genau einmal', () => {
      showExisting({ changed: true });

      button('titleSaveChanges').click();

      expect(update).toHaveBeenCalledTimes(1);
      expect(create).not.toHaveBeenCalled();
    });

    it('speichert ein geaendertes Spiel per Enter genau einmal', () => {
      showExisting({ changed: true });

      pressEnter();

      expect(update).toHaveBeenCalledTimes(1);
      expect(create).not.toHaveBeenCalled();
    });

    // Ohne type war Loeschen der erste Absendeknopf eines unveraenderten
    // Spiels und damit der, den Enter ausloest: Enter in einem Feld loeschte
    // das Spiel ohne Rueckfrage.
    it('loescht ein unveraendertes Spiel nicht per Enter', () => {
      const del = spyOn(
        TestBed.inject(GameService),
        'deleteGame'
      ).and.returnValue(of({ success: true }));
      showExisting();

      pressEnter();

      expect(del).not.toHaveBeenCalled();
    });
  });
});
