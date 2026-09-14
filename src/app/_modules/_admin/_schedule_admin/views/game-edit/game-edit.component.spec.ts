import { getTranslocoTestingModule } from '@floorball/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameEditComponent } from './game-edit.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('GameEditComponent', () => {
  let component: GameEditComponent;
  let fixture: ComponentFixture<GameEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [getTranslocoTestingModule(), HttpClientTestingModule],
      declarations: [GameEditComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GameEditComponent);
    component = fixture.componentInstance;
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

  it('laesst ein bestehendes Spiel unangetastet', () => {
    component.existingGame = {
      person_level_assignment: false,
    } as unknown as typeof component.existingGame;
    component.personLevelAssignmentDefault = true;

    component.ngOnChanges();

    expect(component.game.person_level_assignment).toBe(false);
  });
});
