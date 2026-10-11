import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import { RefereeCourseField, RefereeCourseFieldType } from '@floorball/types';

export interface CourseFieldChange {
  id: number;
  changes: Partial<RefereeCourseField>;
}

const CHOICE_TYPES: RefereeCourseFieldType[] = ['select', 'multi_select'];

/**
 * Zusatzfelder einer Kursanmeldung bearbeiten. Dient für die Felder eines
 * Kurses und für die Vorlagen je Landesverband; die Speicherwege liefern die
 * Eltern über die Ausgaben.
 *
 * `locked`: Es gibt schon Anmeldungen. Typ, Auswahl und Pflicht bestehender
 * Felder sind dann gesperrt (die API lehnt sie ohnehin ab), Löschen
 * archiviert nur.
 */
@Component({
  selector: 'fb-course-field-editor',
  templateUrl: './course-field-editor.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class CourseFieldEditorComponent {
  @Input() fields: RefereeCourseField[] = [];
  @Input() locked = false;
  @Input() busy = false;

  @Output() created = new EventEmitter<RefereeCourseField>();
  @Output() updated = new EventEmitter<CourseFieldChange>();
  @Output() removed = new EventEmitter<RefereeCourseField>();

  readonly fieldTypes: RefereeCourseFieldType[] = [
    'text',
    'textarea',
    'select',
    'multi_select',
    'checkbox',
    'number',
    'date',
  ];

  editingId: number | null = null;
  draft: RefereeCourseField | null = null;
  optionsText = '';
  showNew = false;

  get activeFields(): RefereeCourseField[] {
    return this.fields.filter((f) => !f.archived);
  }

  isChoice(type: RefereeCourseFieldType | undefined): boolean {
    return !!type && CHOICE_TYPES.includes(type);
  }

  startNew(): void {
    this.editingId = null;
    this.showNew = true;
    this.draft = {
      label: '',
      field_type: 'text',
      options: [],
      required: false,
      help_text: '',
      visible_to_lead: true,
      include_in_billing_export: false,
    };
    this.optionsText = '';
  }

  startEdit(field: RefereeCourseField): void {
    this.showNew = false;
    this.editingId = field.id ?? null;
    this.draft = { ...field, options: [...field.options] };
    this.optionsText = field.options.join('\n');
  }

  cancel(): void {
    this.showNew = false;
    this.editingId = null;
    this.draft = null;
  }

  /** Bestehendes Feld mit Anmeldungen: Bedeutung bleibt gesperrt. */
  get meaningLocked(): boolean {
    return this.locked && this.editingId !== null;
  }

  get valid(): boolean {
    if (!this.draft || !this.draft.label.trim()) return false;
    return (
      !this.isChoice(this.draft.field_type) || this.parsedOptions().length >= 2
    );
  }

  save(): void {
    if (!this.draft || !this.valid) return;
    const field: RefereeCourseField = {
      ...this.draft,
      label: this.draft.label.trim(),
      options: this.isChoice(this.draft.field_type) ? this.parsedOptions() : [],
    };
    if (this.editingId === null) {
      this.created.emit(field);
    } else {
      const changes: Partial<RefereeCourseField> = {
        label: field.label,
        help_text: field.help_text,
        visible_to_lead: field.visible_to_lead,
        include_in_billing_export: field.include_in_billing_export,
      };
      if (!this.meaningLocked) {
        changes.field_type = field.field_type;
        changes.options = field.options;
        changes.required = field.required;
      }
      this.updated.emit({ id: this.editingId, changes });
    }
    this.cancel();
  }

  move(field: RefereeCourseField, direction: -1 | 1): void {
    const list = this.activeFields;
    const index = list.indexOf(field);
    const other = list[index + direction];
    if (!other || field.id === undefined || other.id === undefined) return;
    const a = field.position ?? index;
    const b = other.position ?? index + direction;
    // Gleiche Positionen (aus Altbestand) auseinanderziehen.
    const [first, second] = a === b ? [b + direction, a] : [b, a];
    this.updated.emit({ id: field.id, changes: { position: first } });
    this.updated.emit({ id: other.id, changes: { position: second } });
  }

  private parsedOptions(): string[] {
    return [
      ...new Set(
        this.optionsText
          .split('\n')
          .map((o) => o.trim())
          .filter((o) => o !== '')
      ),
    ];
  }
}
