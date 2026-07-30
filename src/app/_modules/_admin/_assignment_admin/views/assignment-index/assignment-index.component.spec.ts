import { getTranslocoTestingModule } from '@floorball/core';
import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RefereeAssignableGame } from '@floorball/types';
import { environment } from 'src/environments/environment';
import { AssignmentIndexComponent } from './assignment-index.component';

describe('AssignmentIndexComponent – Zusätzliche Spielinformationen', () => {
  let component: AssignmentIndexComponent;
  let httpMock: HttpTestingController;

  // Ohne detectChanges läuft ngOnInit nicht: Der Test braucht nur den
  // Notiz-Ablauf, nicht das Laden von Saisons, Vereinen und Spielen.
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [getTranslocoTestingModule(), HttpClientTestingModule],
      declarations: [AssignmentIndexComponent],
    })
      .overrideTemplate(AssignmentIndexComponent, '')
      .compileComponents();

    component = TestBed.createComponent(
      AssignmentIndexComponent
    ).componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  // Struktur einer Zeile der Ansetzungsliste (MergedGame ist modul-intern).
  function row(notes: string | null = null) {
    const game: RefereeAssignableGame = {
      id: 42,
      date: '2026-08-01',
      referee_notes: notes,
    };
    return { game, assignment: null };
  }

  it('öffnet den Editor mit dem hinterlegten Text', () => {
    component.toggleNotes(row('Halleneingang hinten'));

    expect(component.notesOpenGameId).toBe(42);
    expect(component.notesDraft).toBe('Halleneingang hinten');
  });

  it('schließt den Editor beim erneuten Klick', () => {
    const r = row('Alt');
    component.toggleNotes(r);
    component.toggleNotes(r);

    expect(component.notesOpenGameId).toBeNull();
    expect(component.notesDraft).toBe('');
  });

  it('speichert den Text und übernimmt die Antwort in die Zeile', () => {
    const r = row('Alt');
    component.toggleNotes(r);
    component.onNotesInput('Ansprechpartner: Herr Meier');
    component.saveNotes(r);

    const req = httpMock.expectOne(
      environment.apiURL + 'admin/referee_assignments/games/42/notes'
    );
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({
      game: { referee_notes: 'Ansprechpartner: Herr Meier' },
    });

    req.flush({
      game_id: 42,
      referee_notes: 'Ansprechpartner: Herr Meier',
      referee_notes_updated_at: '2026-07-30T10:00:00Z',
      referee_notes_updated_by_name: 'Anna Ansetzer',
    });

    expect(r.game.referee_notes).toBe('Ansprechpartner: Herr Meier');
    expect(r.game.referee_notes_updated_by_name).toBe('Anna Ansetzer');
    expect(component.notesOpenGameId).toBeNull();
    expect(component.notesSavingGameId).toBeNull();
  });

  it('leerer Text löscht den Hinweis', () => {
    const r = row('Alt');
    component.toggleNotes(r);
    component.onNotesInput('');
    component.saveNotes(r);

    const req = httpMock.expectOne(
      environment.apiURL + 'admin/referee_assignments/games/42/notes'
    );
    expect(req.request.body).toEqual({ game: { referee_notes: '' } });

    req.flush({ game_id: 42, referee_notes: null });

    expect(r.game.referee_notes).toBeNull();
  });

  it('wertet reine Leerzeichen nicht als Hinweis', () => {
    expect(component.hasNotes(row('   '))).toBe(false);
    expect(component.hasNotes(row('Hinweis'))).toBe(true);
    expect(component.hasNotes(row())).toBe(false);
  });
});
