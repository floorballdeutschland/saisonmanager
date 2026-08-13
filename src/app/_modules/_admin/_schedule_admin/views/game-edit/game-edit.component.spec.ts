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

  it('laesst ein bestehendes Spiel unangetastet', () => {
    component.existingGame = {
      person_level_assignment: false,
    } as unknown as typeof component.existingGame;
    component.personLevelAssignmentDefault = true;

    component.ngOnChanges();

    expect(component.game.person_level_assignment).toBe(false);
  });
});
