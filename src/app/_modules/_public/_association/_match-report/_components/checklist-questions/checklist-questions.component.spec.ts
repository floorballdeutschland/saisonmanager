import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChecklistQuestionsComponent } from './checklist-questions.component';

describe('ChecklistQuestionsComponent', () => {
  const items = [
    { id: 7, question: 'War die Halle rechtzeitig offen?', position: 0 },
    { id: 9, question: 'Waren beide Tore vorschriftsmäßig?', position: 1 },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommonModule],
      declarations: [ChecklistQuestionsComponent],
    }).compileComponents();
  });

  function create(
    disabled = false
  ): ComponentFixture<ChecklistQuestionsComponent> {
    const fixture = TestBed.createComponent(ChecklistQuestionsComponent);
    fixture.componentInstance.items = items;
    fixture.componentInstance.answers = { 7: true, 9: null };
    fixture.componentInstance.disabled = disabled;
    fixture.detectChanges();

    return fixture;
  }

  it('zeigt jede Frage mit Ja und Nein', () => {
    const fixture = create();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('War die Halle rechtzeitig offen?');
    expect(text).toContain('Waren beide Tore vorschriftsmäßig?');
    expect(fixture.nativeElement.querySelectorAll('button').length).toBe(4);
  });

  // Die gesetzte Antwort muss sich von der offenen unterscheiden, sonst ist der
  // vorbelegte Stand aus der Spielvorbereitung nicht zu erkennen.
  it('hebt die bereits gegebene Antwort hervor', () => {
    const fixture = create();
    const buttons = fixture.nativeElement.querySelectorAll('button');

    expect(buttons[0].className).toContain('bg-green-600');
    expect(buttons[1].className).not.toContain('bg-red-500');
    expect(buttons[2].className).not.toContain('bg-green-600');
  });

  it('meldet eine Auswahl mit Frage und Antwort nach oben', () => {
    const fixture = create();
    const emitted: { itemId: number; answer: boolean }[] = [];
    fixture.componentInstance.answerSet.subscribe((event) =>
      emitted.push(event)
    );

    fixture.nativeElement.querySelectorAll('button')[3].click();

    expect(emitted).toEqual([{ itemId: 9, answer: false }]);
  });

  // Während des Schreibens darf nichts nachgeschoben werden, sonst geht die
  // zuletzt geklickte Antwort gegen einen bereits abgeschickten Stand verloren.
  it('meldet nichts, solange gesperrt', () => {
    const fixture = create(true);
    const emitted: { itemId: number; answer: boolean }[] = [];
    fixture.componentInstance.answerSet.subscribe((event) =>
      emitted.push(event)
    );

    fixture.componentInstance.select(9, false);

    expect(emitted).toEqual([]);
  });
});
