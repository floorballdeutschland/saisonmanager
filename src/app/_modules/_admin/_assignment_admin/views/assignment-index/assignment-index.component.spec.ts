import { getTranslocoTestingModule } from '@floorball/core';
import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import {
  RefereeAssignableGame,
  RefereeAssignmentAvailable,
} from '@floorball/types';
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
      // Die Komponente liest über den SessionService, ob der reduzierte Modus
      // (Weg 3) gilt. SessionService hängt am Router, der sonst hier fehlt.
      providers: [provideRouter([])],
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
  function row(notes: string | null = null, id = 42) {
    const game: RefereeAssignableGame = {
      id,
      date: '2026-08-01',
      referee_notes: notes,
    };
    return { game, assignment: null };
  }

  function notesUrl(id = 42) {
    return environment.apiURL + `admin/referee_assignments/games/${id}/notes`;
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

  // Der Editor-Zustand gilt für die ganze Tabelle. Ohne Sperre würde die
  // Antwort des ersten Speichervorgangs den inzwischen geöffneten Entwurf einer
  // anderen Zeile schließen und verwerfen.
  it('schaltet während des Speicherns nicht auf eine andere Zeile um', () => {
    const a = row('A alt', 42);
    const b = row('B alt', 43);

    component.toggleNotes(a);
    component.onNotesInput('A neu');
    component.saveNotes(a);

    component.toggleNotes(b);
    expect(component.notesOpenGameId).toBe(42);
    expect(component.notesDraft).toBe('A neu');

    httpMock.expectOne(notesUrl(42)).flush({
      game_id: 42,
      referee_notes: 'A neu',
    });

    expect(component.notesOpenGameId).toBeNull();
    expect(a.game.referee_notes).toBe('A neu');
    expect(b.game.referee_notes).toBe('B alt');
  });

  it('wertet reine Leerzeichen nicht als Hinweis', () => {
    expect(component.hasNotes(row('   '))).toBe(false);
    expect(component.hasNotes(row('Hinweis'))).toBe(true);
    expect(component.hasNotes(row())).toBe(false);
  });
});

describe('AssignmentIndexComponent – Gespann-Kurzliste', () => {
  let component: AssignmentIndexComponent;
  let httpMock: HttpTestingController;

  const GAME_ID = 7;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [getTranslocoTestingModule(), HttpClientTestingModule],
      declarations: [AssignmentIndexComponent],
      providers: [provideRouter([])],
    })
      .overrideTemplate(AssignmentIndexComponent, '')
      .compileComponents();

    component = TestBed.createComponent(
      AssignmentIndexComponent
    ).componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  // Kandidat der Tagesliste. Die Lizenznummer ist aus der PK abgeleitet, damit
  // der hinterlegte Partner im Test nachvollziehbar adressiert werden kann.
  function candidate(
    id: number,
    nachname: string,
    partnerLizenznummer?: number
  ): RefereeAssignmentAvailable {
    return {
      id,
      lizenznummer: 1000 + id,
      lizenznummer_display: `${1000 + id}`,
      vorname: 'Vorname',
      nachname,
      partner_lizenznummer: partnerLizenznummer ?? null,
    };
  }

  // Zeile mit bereits geladener Kandidatenliste. Schiri 1 wird aus derselben
  // Liste gewählt, steht also mit drin.
  function prepareRow(candidates: RefereeAssignmentAvailable[]) {
    component.rows = [
      { game: { id: GAME_ID, date: '2026-08-01' }, assignment: null },
    ];
    const state = component['_createRowState'](null);
    state.availableReferees = candidates;
    component.rowStates.set(GAME_ID, state);
    return state;
  }

  function partnersUrl(refereeId: number) {
    return environment.apiURL + `admin/referees/${refereeId}/partners`;
  }

  function names(query = ''): string[] {
    return component
      .partnerSortedReferees(GAME_ID, query)
      .map((r) => r.nachname);
  }

  it('zieht die hinterlegte Nummer vor die häufigsten Partner', () => {
    // Albert hat 1003 (Zander) im Profil, pfeift laut Bericht aber öfter mit
    // Meier. Die ausdrückliche Angabe steht trotzdem oben.
    const state = prepareRow([
      candidate(1, 'Albert', 1003),
      candidate(2, 'Bauer'),
      candidate(3, 'Zander'),
      candidate(4, 'Meier'),
    ]);

    component.selectReferee1(GAME_ID, state.availableReferees[0]);

    httpMock.expectOne(partnersUrl(1)).flush({
      partners: [
        { referee_id: 4, games_total: 12, games_current_season: 3 },
        { referee_id: 2, games_total: 4, games_current_season: 0 },
      ],
    });

    expect(names()).toEqual(['Zander', 'Meier', 'Bauer', 'Albert']);
  });

  it('lässt die Liste für Schiri 1 unberührt', () => {
    const state = prepareRow([
      candidate(1, 'Albert', 1003),
      candidate(2, 'Bauer'),
      candidate(3, 'Zander'),
    ]);

    component.selectReferee1(GAME_ID, state.availableReferees[0]);
    httpMock.expectOne(partnersUrl(1)).flush({
      partners: [{ referee_id: 2, games_total: 9, games_current_season: 2 }],
    });

    expect(
      component.filteredReferees(GAME_ID, '').map((r) => r.nachname)
    ).toEqual(['Albert', 'Bauer', 'Zander']);
  });

  it('übergeht Partner, die am Spieltag nicht zur Auswahl stehen', () => {
    const state = prepareRow([
      candidate(1, 'Albert'),
      candidate(2, 'Bauer'),
      candidate(3, 'Zander'),
    ]);

    component.selectReferee1(GAME_ID, state.availableReferees[0]);
    httpMock.expectOne(partnersUrl(1)).flush({
      partners: [
        { referee_id: 99, games_total: 40, games_current_season: 10 },
        { referee_id: 3, games_total: 2, games_current_season: 1 },
      ],
    });

    expect(names()).toEqual(['Zander', 'Albert', 'Bauer']);
  });

  it('begrenzt die Kurzliste auf fünf Namen aus der Historie', () => {
    const state = prepareRow([
      candidate(1, 'Albert'),
      candidate(2, 'B'),
      candidate(3, 'C'),
      candidate(4, 'D'),
      candidate(5, 'E'),
      candidate(6, 'F'),
      candidate(7, 'G'),
    ]);

    component.selectReferee1(GAME_ID, state.availableReferees[0]);
    httpMock.expectOne(partnersUrl(1)).flush({
      partners: [2, 3, 4, 5, 6, 7].map((id) => ({
        referee_id: id,
        games_total: 10 - id,
        games_current_season: 1,
      })),
    });

    // G steht als sechster Eintrag der Historie nicht mehr oben, sondern
    // wieder an seiner alphabetischen Stelle.
    expect(names()).toEqual(['B', 'C', 'D', 'E', 'F', 'Albert', 'G']);
  });

  it('fragt die Historie je Person nur einmal ab', () => {
    const state = prepareRow([candidate(1, 'Albert'), candidate(2, 'Bauer')]);

    component.selectReferee1(GAME_ID, state.availableReferees[0]);
    httpMock.expectOne(partnersUrl(1)).flush({
      partners: [{ referee_id: 2, games_total: 3, games_current_season: 1 }],
    });

    component.clearReferee1(GAME_ID);
    component.selectReferee1(GAME_ID, state.availableReferees[0]);
    component.onReferee2Focus(GAME_ID);

    httpMock.expectNone(partnersUrl(1));
    expect(names()).toEqual(['Bauer', 'Albert']);
  });

  it('behält die alphabetische Liste, wenn die Historie nicht lädt', () => {
    const state = prepareRow([
      candidate(1, 'Albert', 1003),
      candidate(2, 'Bauer'),
      candidate(3, 'Zander'),
    ]);

    component.selectReferee1(GAME_ID, state.availableReferees[0]);
    httpMock
      .expectOne(partnersUrl(1))
      .flush('kaputt', { status: 500, statusText: 'Server Error' });

    // Die hinterlegte Nummer steht weiter oben, sie kommt aus der
    // Kandidatenliste und braucht die Historie nicht.
    expect(names()).toEqual(['Zander', 'Albert', 'Bauer']);

    // Kein neuer Versuch bei jedem Fokuswechsel.
    component.onReferee2Focus(GAME_ID);
    httpMock.expectNone(partnersUrl(1));
  });

  it('ohne Schiri 1 bleibt die Reihenfolge des Servers', () => {
    prepareRow([candidate(1, 'Albert'), candidate(2, 'Bauer')]);

    expect(names()).toEqual(['Albert', 'Bauer']);
  });
});
