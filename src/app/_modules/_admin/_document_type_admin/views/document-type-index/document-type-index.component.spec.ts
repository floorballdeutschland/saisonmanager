import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { getTranslocoTestingModule } from '@floorball/core';
import { DocumentType } from '@floorball/types';
import { DocumentTypeIndexComponent } from './document-type-index.component';

describe('DocumentTypeIndexComponent', () => {
  let component: DocumentTypeIndexComponent;

  const documentType = (overrides: Partial<DocumentType> = {}): DocumentType =>
    ({
      id: 1,
      key: 'attest',
      name: 'Sportärztliches Attest',
      description: null,
      game_operation_id: null,
      validity: 'once',
      required_below_age: null,
      required_from_birth_year: null,
      template_url: null,
      ...overrides,
    }) as DocumentType;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [DocumentTypeIndexComponent],
    })
      .overrideTemplate(DocumentTypeIndexComponent, '')
      .compileComponents();

    component = TestBed.createComponent(
      DocumentTypeIndexComponent
    ).componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Die Regelart steht nicht in den Daten, sie wird aus den beiden Zahlfeldern
  // gelesen – sonst wäre das Bearbeiten-Formular beim Öffnen leer.
  it('leitet die Regelart aus dem Eintrag ab', () => {
    expect(component.ageRuleOf(documentType())).toBe('none');
    expect(component.ageRuleOf(documentType({ required_below_age: 16 }))).toBe(
      'below_age'
    );
    expect(
      component.ageRuleOf(documentType({ required_from_birth_year: 2012 }))
    ).toBe('from_birth_year');
  });

  it('startEdit übernimmt die Regelart des Eintrags', () => {
    component.startEdit(documentType({ required_from_birth_year: 2012 }));

    expect(component.editAgeRule).toBe('from_birth_year');
    expect(component.editBuffer.required_from_birth_year).toBe(2012);
  });

  // Der Kern: Die beiden Formen schließen sich aus, die API lehnt beide zusammen
  // ab. Beim Wechsel muss die vorherige Angabe daher aus dem Puffer verschwinden.
  it('Wechsel der Regelart räumt die nicht gewählte Angabe ab', () => {
    component.startEdit(documentType({ required_below_age: 16 }));

    component.setEditAgeRule('from_birth_year');
    expect(component.editBuffer.required_below_age).toBeNull();
    component.editBuffer.required_from_birth_year = 2012;

    component.setEditAgeRule('below_age');
    expect(component.editBuffer.required_from_birth_year).toBeNull();

    component.setEditAgeRule('none');
    expect(component.editBuffer.required_below_age).toBeNull();
    expect(component.editBuffer.required_from_birth_year).toBeNull();
  });

  it('das Anlege-Formular startet ohne Altersregel', () => {
    expect(component.newAgeRule).toBe('none');
    expect(component.newType.required_below_age).toBeNull();
    expect(component.newType.required_from_birth_year).toBeNull();
  });

  it('cancelEdit setzt die Regelart zurück', () => {
    component.startEdit(documentType({ required_below_age: 16 }));
    component.cancelEdit();

    expect(component.editAgeRule).toBe('none');
  });
});
