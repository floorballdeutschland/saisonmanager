import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { ChecklistItem } from '@floorball/types';

/**
 * Die Fragen der Spieltagscheckliste, je Frage ein Ja und ein Nein.
 *
 * Reine Darstellung: Die Komponente hält keinen Stand und speichert nichts,
 * sie bekommt die Antworten gereicht und meldet jede Auswahl nach oben. Eigene
 * Komponente, weil dieselbe Liste jetzt an zwei Stellen steht -- vor dem Spiel
 * in den Spielinformationen und beim Abschließen des Spielberichts im Fenster
 * darüber. Zweimal ausgeschrieben liefen die beiden Fassungen auseinander,
 * sobald an einer Frage etwas anders aussehen soll.
 */
@Component({
  selector: 'fb-checklist-questions',
  templateUrl: './checklist-questions.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class ChecklistQuestionsComponent {
  @Input()
  items: ChecklistItem[] = [];

  @Input()
  answers: Record<number, boolean | null> = {};

  @Input()
  disabled = false;

  @Output()
  answerSet = new EventEmitter<{ itemId: number; answer: boolean }>();

  public select(itemId: number, answer: boolean): void {
    if (this.disabled) return;

    this.answerSet.emit({ itemId, answer });
  }
}
