import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { getTranslocoTestingModule } from '@floorball/core';
import { RefereeCourseField } from '@floorball/types';
import {
  CourseFieldChange,
  CourseFieldEditorComponent,
} from './course-field-editor.component';

const TSHIRT: RefereeCourseField = {
  id: 5,
  label: 'T-Shirt',
  field_type: 'select',
  options: ['S', 'M'],
  required: true,
  position: 1,
  visible_to_lead: true,
  include_in_billing_export: false,
};

describe('CourseFieldEditorComponent', () => {
  function render(fields: RefereeCourseField[], locked = false) {
    TestBed.configureTestingModule({
      imports: [FormsModule, getTranslocoTestingModule()],
      declarations: [CourseFieldEditorComponent],
    });
    const fixture = TestBed.createComponent(CourseFieldEditorComponent);
    fixture.componentRef.setInput('fields', fields);
    fixture.componentRef.setInput('locked', locked);
    fixture.detectChanges();
    return fixture;
  }

  it('legt ein Auswahlfeld erst mit zwei Optionen an', () => {
    const fixture = render([]);
    const c = fixture.componentInstance;
    const created: RefereeCourseField[] = [];
    c.created.subscribe((f) => created.push(f));

    c.startNew();
    c.draft!.label = ' Ernährung ';
    c.draft!.field_type = 'select';
    c.optionsText = 'vegan\n';
    expect(c.valid).toBeFalse();

    c.optionsText = 'vegan\nvegetarisch\nvegan\n ';
    c.save();
    expect(created.length).toBe(1);
    expect(created[0].label).toBe('Ernährung');
    expect(created[0].options).toEqual(['vegan', 'vegetarisch']);
  });

  it('schickt bei gesperrten Feldern nur Text und Sichtbarkeit', () => {
    const fixture = render([TSHIRT], true);
    const c = fixture.componentInstance;
    const updates: CourseFieldChange[] = [];
    c.updated.subscribe((u) => updates.push(u));

    c.startEdit(TSHIRT);
    expect(c.meaningLocked).toBeTrue();
    c.draft!.label = 'T-Shirt-Größe';
    c.draft!.required = false;
    c.save();

    expect(updates[0].id).toBe(5);
    expect(updates[0].changes.label).toBe('T-Shirt-Größe');
    expect('required' in updates[0].changes).toBeFalse();
    expect('options' in updates[0].changes).toBeFalse();
  });

  it('blendet archivierte Felder aus', () => {
    const fixture = render([TSHIRT, { ...TSHIRT, id: 6, archived: true }]);
    expect(
      fixture.nativeElement.querySelectorAll('[data-test="field-row"]').length
    ).toBe(1);
  });

  it('tauscht beim Verschieben die Positionen zweier Felder', () => {
    const second = { ...TSHIRT, id: 6, position: 2, label: 'Anreise' };
    const fixture = render([TSHIRT, second]);
    const updates: CourseFieldChange[] = [];
    fixture.componentInstance.updated.subscribe((u) => updates.push(u));

    fixture.componentInstance.move(second, -1);

    expect(updates).toEqual([
      { id: 6, changes: { position: 1 } },
      { id: 5, changes: { position: 2 } },
    ]);
  });
});
