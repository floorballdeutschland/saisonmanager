import { getTranslocoTestingModule } from '@floorball/core';
import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import {
  RefereeAssignableGame,
  RefereeAssignment,
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
    partnerLizenznummer?: number,
    lizenzstufe?: string
  ): RefereeAssignmentAvailable {
    return {
      id,
      lizenznummer: 1000 + id,
      lizenznummer_display: `${1000 + id}`,
      vorname: 'Vorname',
      nachname,
      partner_lizenznummer: partnerLizenznummer ?? null,
      lizenzstufe,
    };
  }

  // Bestehende Ansetzung mit belegtem Platz 1. Der Server nimmt tagesgleich
  // Angesetzte aus der Kandidatenliste, diese Person steht dort also nicht.
  function assignmentWith(
    refereeId: number,
    nachname: string,
    partnerLizenznummer?: number
  ): RefereeAssignment {
    return {
      id: 500,
      game_id: GAME_ID,
      status: 'published',
      referee1: {
        id: refereeId,
        lizenznummer_display: `${1000 + refereeId}`,
        vorname: 'Vorname',
        nachname,
        partner_lizenznummer: partnerLizenznummer ?? null,
      },
    };
  }

  // Zeile mit bereits geladener Kandidatenliste. Ohne Ansetzung wird Schiri 1
  // aus derselben Liste gewählt und steht damit mit drin.
  function prepareRow(
    candidates: RefereeAssignmentAvailable[],
    assignment: RefereeAssignment | null = null,
    gameId = GAME_ID
  ) {
    const row = { game: { id: gameId, date: '2026-08-01' }, assignment };
    component.rows = [...component.rows, row];
    const state = component['_createRowState'](assignment);
    state.availableReferees = candidates;
    component.rowStates.set(gameId, state);
    return state;
  }

  function partnersUrl(refereeId: number) {
    return environment.apiURL + `admin/referees/${refereeId}/partners`;
  }

  function availableUrl(gameId = GAME_ID) {
    return (
      environment.apiURL +
      `admin/referee_assignments/available?date=2026-08-01&game_id=${gameId}`
    );
  }

  // Antwortzeile der Gespann-Historie.
  function partner(refereeId: number, total: number, season = 0) {
    return {
      referee_id: refereeId,
      games_total: total,
      games_current_season: season,
    };
  }

  function names(query = '', gameId = GAME_ID): string[] {
    return component
      .partnerSortedReferees(gameId, query)
      .map((r) => r.nachname);
  }

  function hints(gameId = GAME_ID) {
    return component.rowStates.get(gameId)!.partnerHints;
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
    // Kandidatenliste und braucht die Historie nicht. Ob nach einem Fehler
    // erneut gefragt wird, hängt am Status – siehe die beiden Fälle unten.
    expect(names()).toEqual(['Zander', 'Albert', 'Bauer']);
  });

  it('ohne Schiri 1 bleibt die Reihenfolge des Servers', () => {
    prepareRow([candidate(1, 'Albert'), candidate(2, 'Bauer')]);

    expect(names()).toEqual(['Albert', 'Bauer']);
  });

  // Der Server nimmt tagesgleich Angesetzte aus der Kandidatenliste, also auch
  // das Gespann dieses Spiels. Bei einer bestehenden Ansetzung steht Schiri 1
  // dort nicht, die hinterlegte Nummer muss deshalb aus der Ansetzung kommen –
  // sonst fehlte die Kurzliste genau in den Zeilen, für die sie gedacht ist.
  it('löst die hinterlegte Nummer auch aus einer bestehenden Ansetzung auf', () => {
    prepareRow(
      [candidate(2, 'Bauer'), candidate(3, 'Zander'), candidate(4, 'Meier')],
      assignmentWith(1, 'Albert', 1003)
    );

    component.onReferee2Focus(GAME_ID);
    httpMock.expectOne(partnersUrl(1)).flush({ partners: [] });

    expect(names()).toEqual(['Zander', 'Bauer', 'Meier']);
    expect(hints().get(3)?.declared).toBe(true);
  });

  // Die Historie kann vor der Kandidatenliste eintreffen. Ohne den zweiten
  // Aufbau im Erfolgszweig der Kandidatenliste bliebe die Kurzliste dann leer,
  // bis der Ansetzer Schiri 1 neu wählt.
  it('trägt eine früher eingetroffene Historie nach', () => {
    prepareRow([], assignmentWith(1, 'Albert'));

    component.onReferee2Focus(GAME_ID);

    httpMock.expectOne(partnersUrl(1)).flush({ partners: [partner(4, 9, 2)] });
    httpMock
      .expectOne(availableUrl())
      .flush([
        candidate(2, 'Bauer'),
        candidate(3, 'Zander'),
        candidate(4, 'Meier'),
      ]);

    expect(names()).toEqual(['Meier', 'Bauer', 'Zander']);
  });

  // Die Vorfilter entscheiden weiter, wer überhaupt erscheint. Ein
  // vorgezogener Partner der falschen Lizenzstufe bleibt ausgeblendet, und die
  // Kurzliste holt ihn auch nicht zurück.
  it('holt einen vom Vorfilter ausgeblendeten Partner nicht zurück', () => {
    const state = prepareRow([
      candidate(1, 'Albert', 1003, 'N2'),
      candidate(2, 'Bauer', undefined, 'N3'),
      candidate(3, 'Zander', undefined, 'L2'),
    ]);
    component.toggleLicenseLevel('N');

    component.selectReferee1(GAME_ID, state.availableReferees[0]);
    httpMock.expectOne(partnersUrl(1)).flush({ partners: [partner(3, 20, 5)] });

    // Zander ist als hinterlegter Partner UND häufigster Partner vorgezogen,
    // fällt aber durch den Lizenzfilter.
    expect(hints().has(3)).toBe(true);
    expect(names()).toEqual(['Albert', 'Bauer']);
  });

  it('sortiert auch innerhalb eines Suchtextes vor', () => {
    const state = prepareRow([
      candidate(1, 'Albert'),
      candidate(2, 'Baum'),
      candidate(3, 'Bauer'),
    ]);

    component.selectReferee1(GAME_ID, state.availableReferees[0]);
    httpMock.expectOne(partnersUrl(1)).flush({ partners: [partner(3, 7, 1)] });

    expect(names('bau')).toEqual(['Bauer', 'Baum']);
  });

  // Eine Anfrage, zwei Zeilen: Die zweite Zeile hat keinen eigenen Weg zur
  // Historie, weil die Anfrage der ersten noch läuft.
  it('trägt die Historie in alle Zeilen mit demselben Schiri 1', () => {
    const first = prepareRow([candidate(1, 'Albert'), candidate(2, 'Bauer')]);
    const second = prepareRow(
      [candidate(1, 'Albert'), candidate(2, 'Bauer')],
      null,
      8
    );

    component.selectReferee1(GAME_ID, first.availableReferees[0]);
    component.selectReferee1(8, second.availableReferees[0]);

    httpMock.expectOne(partnersUrl(1)).flush({ partners: [partner(2, 5, 2)] });

    expect(names()).toEqual(['Bauer', 'Albert']);
    expect(names('', 8)).toEqual(['Bauer', 'Albert']);
  });

  // Was im Dropdown steht: „hinterlegt" für die Profilangabe, die Zahl
  // gemeinsamer Einsätze für die Historie. Ohne Historieneintrag bleibt die
  // Zahl 0 und das Template blendet sie aus.
  it('führt Kennzeichnung und Einsatzzahlen je Kandidat mit', () => {
    const state = prepareRow([
      candidate(1, 'Albert', 1003),
      candidate(3, 'Zander'),
      candidate(4, 'Meier'),
    ]);

    component.selectReferee1(GAME_ID, state.availableReferees[0]);
    httpMock.expectOne(partnersUrl(1)).flush({ partners: [partner(4, 12, 3)] });

    expect(hints().get(3)).toEqual({
      rank: 0,
      declared: true,
      gamesTotal: 0,
      gamesCurrentSeason: 0,
    });
    expect(hints().get(4)).toEqual({
      rank: 1,
      declared: false,
      gamesTotal: 12,
      gamesCurrentSeason: 3,
    });
  });

  // Weitertippen verwirft die Auswahl von Schiri 1. Bliebe die Kurzliste
  // stehen, zeigte das Dropdown Badges und Einsatzzahlen zu einer Person, die
  // gar nicht mehr gewählt ist.
  it('räumt die Kurzliste auf, wenn Schiri 1 übertippt wird', () => {
    const state = prepareRow([
      candidate(1, 'Albert'),
      candidate(2, 'Bauer'),
      candidate(3, 'Zander'),
    ]);

    component.selectReferee1(GAME_ID, state.availableReferees[0]);
    httpMock.expectOne(partnersUrl(1)).flush({ partners: [partner(3, 8, 2)] });
    expect(names()).toEqual(['Zander', 'Albert', 'Bauer']);

    component.onReferee1Input(GAME_ID, 'Alb');

    expect(names()).toEqual(['Albert', 'Bauer', 'Zander']);
  });

  // 403 heißt: Diese Person liegt außerhalb des Personen-Scopes des Ansetzers.
  // Das ändert sich in dieser Sitzung nicht, ein erneuter Versuch wäre nur
  // Last.
  it('fragt nach einem 403 nicht erneut', () => {
    const state = prepareRow([candidate(1, 'Albert'), candidate(2, 'Bauer')]);

    component.selectReferee1(GAME_ID, state.availableReferees[0]);
    httpMock
      .expectOne(partnersUrl(1))
      .flush(
        { error: 'Nicht berechtigt' },
        { status: 403, statusText: 'Forbidden' }
      );

    component.onReferee2Focus(GAME_ID);

    httpMock.expectNone(partnersUrl(1));
    expect(names()).toEqual(['Albert', 'Bauer']);
  });

  // Ein Serverfehler ist vorübergehend. Würde er wie ein 403 leer gecacht,
  // fehlte die Kurzliste dieser Person bis zum Verlassen der Ansicht.
  it('versucht es nach einem Serverfehler erneut', () => {
    const state = prepareRow([candidate(1, 'Albert'), candidate(2, 'Bauer')]);

    component.selectReferee1(GAME_ID, state.availableReferees[0]);
    httpMock
      .expectOne(partnersUrl(1))
      .flush('kaputt', { status: 500, statusText: 'Server Error' });

    component.onReferee2Focus(GAME_ID);

    httpMock.expectOne(partnersUrl(1)).flush({ partners: [partner(2, 4, 1)] });
    expect(names()).toEqual(['Bauer', 'Albert']);
  });

  // Der Deckel gilt für die Kurzliste, nicht für die Historie: Mit hinterlegter
  // Nummer bleiben vier Plätze für die häufigsten Partner.
  it('rechnet die hinterlegte Nummer in den Deckel ein', () => {
    const state = prepareRow([
      candidate(1, 'Albert', 1007),
      candidate(2, 'B'),
      candidate(3, 'C'),
      candidate(4, 'D'),
      candidate(5, 'E'),
      candidate(6, 'F'),
      candidate(7, 'G'),
    ]);

    component.selectReferee1(GAME_ID, state.availableReferees[0]);
    httpMock.expectOne(partnersUrl(1)).flush({
      partners: [2, 3, 4, 5, 6].map((id) => partner(id, 10 - id, 1)),
    });

    expect(names()).toEqual(['G', 'B', 'C', 'D', 'E', 'Albert', 'F']);
  });
});
