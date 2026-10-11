import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import {
  CourseSignupAnswers,
  RefereeCourseField,
  RefereeCourseOffer,
} from '@floorball/types';

/**
 * Anmeldefelder eines Kurses: angestrebte Lizenz, Zusatzfelder des LV und
 * Bemerkung. Geteilt von Portal, Verein und öffentlicher Seite.
 */
@Component({
  selector: 'fb-course-signup-fields',
  templateUrl: './course-signup-fields.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class CourseSignupFieldsComponent {
  @Input({ required: true }) offer!: RefereeCourseOffer;
  @Input({ required: true }) answers!: CourseSignupAnswers;
  @Output() answersChange = new EventEmitter<CourseSignupAnswers>();

  get fields(): RefereeCourseField[] {
    return this.offer.fields.filter((f) => !f.archived);
  }

  key(field: RefereeCourseField): string {
    return String(field.id);
  }

  value(field: RefereeCourseField): unknown {
    return this.answers.custom_answers[this.key(field)];
  }

  checked(field: RefereeCourseField, option: string): boolean {
    const value = this.value(field);
    return Array.isArray(value) && value.includes(option);
  }

  set(field: RefereeCourseField, value: unknown): void {
    this.emit({
      ...this.answers,
      custom_answers: {
        ...this.answers.custom_answers,
        [this.key(field)]: value,
      },
    });
  }

  toggleOption(field: RefereeCourseField, option: string, on: boolean): void {
    const current = (this.value(field) as string[] | undefined) ?? [];
    const next = current.filter((o) => o !== option);
    this.set(field, on ? [...next, option] : next);
  }

  setLevel(id: number | null): void {
    this.emit({ ...this.answers, desired_license_level_id: id });
  }

  setRemarks(remarks: string): void {
    this.emit({ ...this.answers, remarks });
  }

  private emit(answers: CourseSignupAnswers): void {
    this.answers = answers;
    this.answersChange.emit(answers);
  }
}
