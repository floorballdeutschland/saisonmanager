import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import { RefereeFeedbackAnswers } from '@floorball/types';

/**
 * Der Fragebogen selbst (2 Bewertungen 1–10 + 3 Freitexte). Von beiden
 * Abgabewegen genutzt: angemeldet in der Team-Übersicht und ohne Anmeldung über
 * den Einmal-Link (Kapitän*in), damit die Fragen nur an einer Stelle stehen.
 */
@Component({
  selector: 'fb-referee-feedback-form',
  templateUrl: './referee-feedback-form.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class RefereeFeedbackFormComponent {
  /** Läuft ein Absende-Request? Sperrt die Schaltflächen. */
  @Input() submitting = false;
  /** In der Team-Übersicht klappt das Formular zu, auf der Link-Seite nicht. */
  @Input() cancelable = true;

  @Output() submitted = new EventEmitter<RefereeFeedbackAnswers>();
  @Output() cancelled = new EventEmitter<void>();

  ratingScale = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  lineRating: number | null = null;
  lineComment = '';
  communicationRating: number | null = null;
  communicationComment = '';
  generalComment = '';

  canSubmit(): boolean {
    return this.lineRating !== null && this.communicationRating !== null;
  }

  submit(): void {
    if (!this.canSubmit()) return;

    this.submitted.emit({
      line_rating: this.lineRating as number,
      line_comment: this.lineComment.trim() || undefined,
      communication_rating: this.communicationRating as number,
      communication_comment: this.communicationComment.trim() || undefined,
      general_comment: this.generalComment.trim() || undefined,
    });
  }

  reset(): void {
    this.lineRating = null;
    this.lineComment = '';
    this.communicationRating = null;
    this.communicationComment = '';
    this.generalComment = '';
  }
}
