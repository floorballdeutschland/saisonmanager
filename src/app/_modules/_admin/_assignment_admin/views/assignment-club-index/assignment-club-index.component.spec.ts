import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { environment } from 'src/environments/environment';
import { getTranslocoTestingModule } from '@floorball/core';
import { AssignmentClubIndexComponent } from './assignment-club-index.component';

describe('AssignmentClubIndexComponent', () => {
  let fixture: ComponentFixture<AssignmentClubIndexComponent>;
  let component: AssignmentClubIndexComponent;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AssignmentClubIndexComponent],
      imports: [CommonModule, FormsModule, getTranslocoTestingModule()],
      providers: [provideHttpClient(), provideHttpClientTesting()],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(AssignmentClubIndexComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  function flushInit(games: unknown[]) {
    fixture.detectChanges();
    httpMock
      .expectOne((r) => r.url.includes('settings/seasons'))
      .flush({
        seasons: [{ id: 17, name: '2025/2026', current: true }],
        current_season_id: 17,
      });
    httpMock
      .expectOne((r) => r.url.includes('admin/referee_assignments/games'))
      .flush(games);
  }

  it('übernimmt den Freitext eines Spiels ohne Verein in die Zeile', () => {
    flushInit([
      {
        id: 1,
        league_id: 5,
        nominated_referee_string: 'Müller / Schmidt',
        assignment_club_id: null,
      },
    ]);
    httpMock.expectOne((r) => r.url.includes('league_clubs')).flush([]);

    expect(component.rowStates[1].freeText).toBe('Müller / Schmidt');
    expect(component.rowStates[1].clubId).toBeNull();
  });

  // Steht ein Verein, gehört der Text ihm. Stünde er zusätzlich im Freitextfeld,
  // schriebe das nächste Speichern ihn als Freitext zurück und löschte damit die
  // Verknüpfung, an der die spätere Selbstbenennung durch den Verein hängt.
  it('laesst das Freitextfeld leer, wenn ein Verein angesetzt ist', () => {
    flushInit([
      {
        id: 2,
        league_id: 5,
        nominated_referee_string: 'SV Musterstadt',
        assignment_club_id: 42,
      },
    ]);
    httpMock.expectOne((r) => r.url.includes('league_clubs')).flush([]);

    expect(component.rowStates[2].clubId).toBe(42);
    expect(component.rowStates[2].freeText).toBe('');
  });

  it('speichert den Verein und schliesst den Freitext aus', () => {
    flushInit([{ id: 3, league_id: 5, nominated_referee_string: '' }]);
    httpMock.expectOne((r) => r.url.includes('league_clubs')).flush([]);

    component.rowStates[3].clubId = 7;
    component.onClubChange(component.games[0]);
    component.save(component.games[0]);

    const req = httpMock.expectOne(
      environment.apiURL + 'admin/referee_assignments/games/3/club_assignment'
    );
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ club_id: 7 });
    req.flush({
      game_id: 3,
      nominated_referee_string: 'SV Musterstadt',
      assignment_club_id: 7,
    });

    expect(component.games[0].assignment_club_id).toBe(7);
  });

  it('speichert den Freitext und loest den Verein', () => {
    flushInit([
      {
        id: 4,
        league_id: 5,
        nominated_referee_string: '',
        assignment_club_id: 9,
      },
    ]);
    httpMock.expectOne((r) => r.url.includes('league_clubs')).flush([]);

    component.rowStates[4].freeText = 'Meier / Krause';
    component.onFreeTextChange(component.games[0]);
    expect(component.rowStates[4].clubId).toBeNull();

    component.save(component.games[0]);
    const req = httpMock.expectOne(
      environment.apiURL + 'admin/referee_assignments/games/4/club_assignment'
    );
    expect(req.request.body).toEqual({
      nominated_referee_string: 'Meier / Krause',
    });
    req.flush({
      game_id: 4,
      nominated_referee_string: 'Meier / Krause',
      assignment_club_id: null,
    });

    expect(component.games[0].assignment_club_id).toBeNull();
  });

  // Die RSK arbeitet eine Liga Spieltag für Spieltag ab. Ohne Vorauswahl und
  // Gruppierung stünde sie wieder vor einer ligaübergreifenden Datumsliste.
  it('waehlt die erste Liga vor und gruppiert deren Spiele nach Spieltag', () => {
    flushInit([
      {
        id: 1,
        league_id: 5,
        league: 'A-Liga',
        game_day_id: 11,
        game_day_number: 1,
        date: '2026-09-12',
      },
      {
        id: 2,
        league_id: 5,
        league: 'A-Liga',
        game_day_id: 11,
        game_day_number: 1,
        date: '2026-09-12',
      },
      {
        id: 3,
        league_id: 5,
        league: 'A-Liga',
        game_day_id: 12,
        game_day_number: 2,
        date: '2026-09-26',
      },
      {
        id: 4,
        league_id: 6,
        league: 'B-Liga',
        game_day_id: 21,
        game_day_number: 1,
        date: '2026-09-05',
      },
    ]);
    // Vereine werden nur für die angezeigte Liga geholt, nicht für jede geladene.
    const clubRequests = httpMock.match((r) => r.url.includes('league_clubs'));
    expect(clubRequests.length).toBe(1);
    clubRequests[0].flush([]);

    expect(component.selectedLeagueId).toBe(5);
    expect(component.leagues.map((l) => l.name)).toEqual(['A-Liga', 'B-Liga']);
    expect(component.groups.map((g) => g.key)).toEqual(['gd-11', 'gd-12']);
    expect(component.groups[0].games.map((g) => g.id)).toEqual([1, 2]);
    // Erster Aufbau: alle Spieltage offen.
    expect(component.openGameDays).toEqual(['gd-11', 'gd-12']);

    // Einmal mit Daten rendern: Bindings und Kontrollfluss der Gruppierung
    // stecken im Template und fielen sonst erst im Browser auf.
    fixture.detectChanges();
    const headers: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button[aria-expanded]')
    );
    expect(headers.length).toBe(2);
    expect(headers[0].textContent).toContain('12.09.2026');
  });

  it('zeigt nach dem Ligawechsel nur die Spieltage der neuen Liga', () => {
    flushInit([
      { id: 1, league_id: 5, league: 'A-Liga', game_day_id: 11 },
      { id: 2, league_id: 6, league: 'B-Liga', game_day_id: 21 },
    ]);
    httpMock.expectOne((r) => r.url.includes('league_clubs')).flush([]);

    component.selectedLeagueId = 6;
    component.onLeagueChange();
    httpMock.expectOne((r) => r.url.includes('league_clubs')).flush([]);

    expect(component.groups.map((g) => g.key)).toEqual(['gd-21']);
    expect(component.groups[0].games.map((g) => g.id)).toEqual([2]);
  });

  // Gesperrt ist ein Spiel, das personenscharf angesetzt wird oder bereits ein
  // Gespann hat. Beides ist nicht die Aufgabe der RSK, im Zähler hätte es
  // deshalb nichts zu suchen.
  it('zaehlt gesperrte Spiele nicht in den Spieltags-Fortschritt', () => {
    flushInit([
      { id: 1, league_id: 5, game_day_id: 11, assignment_club_id: 7 },
      { id: 2, league_id: 5, game_day_id: 11, nominated_referee_string: '' },
      {
        id: 3,
        league_id: 5,
        game_day_id: 11,
        locked: true,
        nominated_referee_string: 'Meier / Krause',
      },
    ]);
    httpMock.expectOne((r) => r.url.includes('league_clubs')).flush([]);

    const group = component.groups[0];
    expect(group.games.length).toBe(3);
    expect(component.assignableCount(group)).toBe(2);
    expect(component.assignedCount(group)).toBe(1);
  });

  // Zwei Spieltage derselben Liga können auf denselben Tag fallen – über das
  // Datum gruppiert wären sie ein Block.
  it('trennt zwei Spieltage am selben Datum', () => {
    flushInit([
      {
        id: 1,
        league_id: 5,
        game_day_id: 11,
        game_day_number: 1,
        date: '2026-09-12',
      },
      {
        id: 2,
        league_id: 5,
        game_day_id: 12,
        game_day_number: 2,
        date: '2026-09-12',
      },
    ]);
    httpMock.expectOne((r) => r.url.includes('league_clubs')).flush([]);

    expect(component.groups.length).toBe(2);
  });

  // „Alle Ligen" ist der Überblick, nicht der Arbeitsmodus: alle Spieltage aller
  // Ligen gleichzeitig offen hieße eine Vereinsanfrage je Liga des Verbands.
  it('startet Alle Ligen zugeklappt und laedt dafuer keine Vereine', () => {
    flushInit([
      { id: 1, league_id: 5, league: 'A-Liga', game_day_id: 11 },
      { id: 2, league_id: 6, league: 'B-Liga', game_day_id: 21 },
    ]);
    httpMock.expectOne((r) => r.url.includes('league_clubs')).flush([]);

    component.selectedLeagueId = null;
    component.onLeagueChange();
    httpMock.expectNone((r) => r.url.includes('league_clubs'));

    expect(component.groups.map((g) => g.key)).toEqual(['gd-11', 'gd-21']);
    expect(component.openGameDays).toEqual([]);

    // Erst das Aufklappen holt die Vereine der betroffenen Liga.
    component.toggleGameDay('gd-21');
    httpMock
      .expectOne((r) => r.url.includes('league_clubs') && r.url.includes('6'))
      .flush([]);
  });

  // Ohne Liga-Vorauswahl steht die Liga sonst nirgends mehr auf dem Bildschirm.
  it('zeigt die Liga im Spieltagskopf, wenn alle Ligen gewaehlt sind', () => {
    flushInit([
      {
        id: 1,
        league_id: 5,
        league: 'A-Liga',
        game_day_id: 11,
        date: '2026-09-12',
      },
    ]);
    httpMock.expectOne((r) => r.url.includes('league_clubs')).flush([]);

    component.selectedLeagueId = null;
    component.onLeagueChange();
    fixture.detectChanges();

    expect(component.groups[0].league).toBe('A-Liga');
    const header: HTMLElement = fixture.nativeElement.querySelector(
      'button[aria-expanded]'
    );
    expect(header.textContent).toContain('A-Liga');
  });

  // Ein leeres Array im Zwischenspeicher wäre für den Wächter ein gültiges
  // Ergebnis: die Liga würde nie wieder angefragt und die Auswahl bliebe bis
  // zum Neuladen der Seite leer.
  it('merkt sich einen gescheiterten Vereins-Abruf nicht als leeres Ergebnis', () => {
    flushInit([{ id: 1, league_id: 5, game_day_id: 11 }]);
    httpMock
      .expectOne((r) => r.url.includes('league_clubs'))
      .flush(null, { status: 500, statusText: 'Server Error' });

    expect(component.clubsFailedFor(component.games[0])).toBeTrue();

    component.retryClubs(component.games[0]);
    httpMock
      .expectOne((r) => r.url.includes('league_clubs'))
      .flush([{ id: 3, name: 'SV Musterstadt' }]);

    expect(component.clubsFailedFor(component.games[0])).toBeFalse();
    expect(component.clubsFor(component.games[0]).length).toBe(1);
  });

  it('haelt ein bewusstes Zuklappen ueber das naechste Laden hinweg', () => {
    flushInit([{ id: 1, league_id: 5, game_day_id: 11 }]);
    httpMock.expectOne((r) => r.url.includes('league_clubs')).flush([]);
    expect(component.openGameDays).toEqual(['gd-11']);

    component.toggleAllGameDays();
    expect(component.openGameDays).toEqual([]);

    component.load();
    httpMock
      .expectOne((r) => r.url.includes('admin/referee_assignments/games'))
      .flush([{ id: 1, league_id: 5, game_day_id: 11 }]);

    expect(component.openGameDays).toEqual([]);
  });

  // Speichern schreibt in dasselbe Spiel-Objekt, an dem der Zähler hängt.
  it('zieht den Spieltags-Zaehler nach dem Speichern nach', () => {
    flushInit([
      { id: 1, league_id: 5, game_day_id: 11, nominated_referee_string: '' },
      { id: 2, league_id: 5, game_day_id: 11, nominated_referee_string: '' },
    ]);
    httpMock.expectOne((r) => r.url.includes('league_clubs')).flush([]);
    expect(component.assignedCount(component.groups[0])).toBe(0);

    component.rowStates[1].clubId = 7;
    component.save(component.games[0]);
    httpMock
      .expectOne((r) => r.url.includes('games/1/club_assignment'))
      .flush({
        game_id: 1,
        nominated_referee_string: 'SV Musterstadt',
        assignment_club_id: 7,
      });

    expect(component.assignedCount(component.groups[0])).toBe(1);
    expect(component.assignableCount(component.groups[0])).toBe(2);
  });

  // Ohne Eintrag und ohne Bestand ist Speichern keine Aenderung. Sonst schriebe
  // ein Klick auf der noch leeren Zeile eine leere Ansetzung und meldete Erfolg.
  it('speichert eine leere Zeile ohne Bestand nicht', () => {
    flushInit([{ id: 1, league_id: 5, game_day_id: 11 }]);
    httpMock.expectOne((r) => r.url.includes('league_clubs')).flush([]);

    component.save(component.games[0]);

    httpMock.expectNone((r) => r.url.includes('club_assignment'));
  });

  // Fällt die Spieltags-Kennung aus (Frontend vor der API live), trennt die
  // Rückfall-Gruppierung wenigstens die Hallen.
  it('gruppiert ohne Spieltags-Kennung nach Liga, Datum und Halle', () => {
    flushInit([
      { id: 1, league_id: 5, date: '2026-09-12', arena: 'Halle Nord' },
      { id: 2, league_id: 5, date: '2026-09-12', arena: 'Halle Nord' },
      { id: 3, league_id: 5, date: '2026-09-12', arena: 'Halle Sued' },
    ]);
    httpMock.expectOne((r) => r.url.includes('league_clubs')).flush([]);

    expect(component.groups.map((g) => g.games.length)).toEqual([2, 1]);
    expect(component.groups[1].arena).toBe('Halle Sued');
  });

  // Gleichnamige Ligen zweier Verbaende waeren in der Auswahl sonst nicht zu
  // unterscheiden, und die Spiele der zweiten blieben unbemerkt liegen.
  it('ergaenzt den Verband nur bei gleichnamigen Ligen', () => {
    flushInit([
      {
        id: 1,
        league_id: 5,
        league: 'Bezirksliga',
        game_operation: 'SBK Ost',
        game_day_id: 11,
      },
      {
        id: 2,
        league_id: 6,
        league: 'Bezirksliga',
        game_operation: 'SBK West',
        game_day_id: 21,
      },
      {
        id: 3,
        league_id: 7,
        league: 'Landesliga',
        game_operation: 'SBK Ost',
        game_day_id: 31,
      },
    ]);
    httpMock.expectOne((r) => r.url.includes('league_clubs')).flush([]);

    expect(component.leagues.map((l) => l.label)).toEqual([
      'Bezirksliga (SBK Ost)',
      'Bezirksliga (SBK West)',
      'Landesliga',
    ]);
  });

  afterEach(() => httpMock.verify());
});
