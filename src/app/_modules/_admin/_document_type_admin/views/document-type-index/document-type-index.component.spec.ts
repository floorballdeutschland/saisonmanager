import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { getTranslocoTestingModule } from '@floorball/core';
import { DocumentType } from '@floorball/types';
import { DocumentTypeIndexComponent } from './document-type-index.component';

describe('DocumentTypeIndexComponent', () => {
  let component: DocumentTypeIndexComponent;
  let httpMock: HttpTestingController;

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
    httpMock = TestBed.inject(HttpTestingController);
    // ngOnInit lädt Ligen und den Katalog; für diese Tests ohne Belang.
    httpMock.match(() => true).forEach((r) => r.flush([]));
  });

  afterEach(() => {
    httpMock.verify();
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

  it('cancelNew setzt die Regelart zurück', () => {
    component.setNewAgeRule('from_birth_year');
    component.newType.required_from_birth_year = 2012;
    component.cancelNew();

    expect(component.newAgeRule).toBe('none');
    expect(component.newType.required_from_birth_year).toBeNull();
  });

  // Eine gewählte Regelart ohne Zahl darf nicht gespeichert werden: Über die
  // Leitung gingen beide Felder leer, die API käme auf "keine Altersregel", und
  // die Dokumentart wäre anschließend für ALLE erforderlich — mit Erfolgsmeldung.
  describe('Vollständigkeit der Altersregel', () => {
    it('erkennt die fehlende Zahl je Regelart', () => {
      expect(component.ageRuleComplete({}, 'none')).toBe(true);
      expect(component.ageRuleComplete({}, 'below_age')).toBe(false);
      expect(component.ageRuleComplete({}, 'from_birth_year')).toBe(false);
      expect(
        component.ageRuleComplete({ required_below_age: 16 }, 'below_age')
      ).toBe(true);
      expect(
        component.ageRuleComplete(
          { required_from_birth_year: 2012 },
          'from_birth_year'
        )
      ).toBe(true);
    });

    it('speichert nicht, solange die Zahl fehlt', () => {
      component.startEdit(documentType({ required_below_age: 16 }));
      component.setEditAgeRule('from_birth_year');

      expect(component.editComplete).toBe(false);
      component.saveEdit();
      httpMock.expectNone(
        (r) => r.method === 'PATCH' || r.method === 'POST',
        'ohne Jahrgang darf kein Request rausgehen'
      );

      component.editBuffer.required_from_birth_year = 2012;
      expect(component.editComplete).toBe(true);
    });
  });

  // Der Leitungskontrakt, an dem die ganze Abräum-Kette hängt: BEIDE Zahlfelder
  // müssen mitgehen, auch leer. Ginge das geleerte Feld nicht mit, behielte die
  // Dokumentart serverseitig still die alte Angabe — die Maske zeigte "ab Jg.
  // 2012", die Datenbank behielte "unter 16".
  it('schickt beim Wechsel der Regelart auch das geleerte Feld mit', () => {
    component.startEdit(documentType({ id: 7, required_below_age: 16 }));
    component.setEditAgeRule('from_birth_year');
    component.editBuffer.required_from_birth_year = 2012;

    component.saveEdit();

    const request = httpMock.expectOne(
      (r) => r.method === 'PATCH' && r.url.endsWith('admin/document_types/7')
    );
    const body = request.request.body as FormData;
    expect(body.get('document_type[required_from_birth_year]')).toBe('2012');
    expect(body.has('document_type[required_below_age]')).toBe(true);
    expect(body.get('document_type[required_below_age]')).toBe('');
    request.flush(documentType({ id: 7, required_from_birth_year: 2012 }));
  });
});
