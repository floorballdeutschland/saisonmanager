import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { getTranslocoTestingModule } from '@floorball/core';
import { StreamingGame } from '@floorball/types';
import { environment } from 'src/environments/environment';

import {
  StreamingIndexComponent,
  kommendesWochenende,
} from './streaming-index.component';

describe('StreamingIndexComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<StreamingIndexComponent>;
  let component: StreamingIndexComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        CommonModule,
        FormsModule,
        HttpClientTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [StreamingIndexComponent],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StreamingIndexComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    // `AssociationService` holt beim ersten Zugriff die Verbandsdaten. Das
    // gehört nicht zu dieser Ansicht, läuft aber über denselben Testbackend --
    // ohne Abräumen scheitert jede Prüfung an einem Abruf, den sie nicht
    // ausgelöst hat.
    http
      .match((request) => request.url.includes('init.json'))
      .forEach((request) => request.flush({}));
    http.verify();
  });

  /** Beantwortet den Ligaabruf des Auswahlfelds, der bei jedem Start läuft. */
  function answerLeagues(): void {
    http.expectOne(`${environment.apiURL}admin/leagues.json`).flush([]);
  }

  function answerGames(games: StreamingGame[]): void {
    const request = http.expectOne((req) =>
      req.url.endsWith('admin/streaming/games')
    );
    request.flush(games);
  }

  function game(id: number, overrides: Partial<StreamingGame> = {}): StreamingGame {
    return {
      id,
      game_number: String(id),
      start_time: '18:00',
      start_at: `2026-09-12T18:00:00+02:00`,
      home_team_name: 'MFBC Leipzig',
      guest_team_name: 'Floor Fighters Chemnitz',
      live_stream_link: null,
      vod_link: null,
      stream_key: 'abcd-efgh',
      streamable: true,
      game_day: {
        id: 1,
        number: 1,
        date: '2026-09-12',
        league_id: 5,
        hosting_club: 'MFBC Leipzig',
        arena: { name: 'Dösner Weg', city: 'Leipzig' },
      },
      league: {
        id: 5,
        name: '1. FBL Herren',
        short_name: '1. FBL',
        stream_playlist: null,
      },
      broadcast: null,
      ...overrides,
    };
  }

  it('lädt beim Öffnen den vorbelegten Zeitraum', () => {
    fixture.detectChanges();
    answerLeagues();

    const request = http.expectOne((req) =>
      req.url.endsWith('admin/streaming/games')
    );
    expect(request.request.params.get('from')).toBe(component.from);
    expect(request.request.params.get('to')).toBe(component.to);
    request.flush([game(1)]);

    expect(component.games.length).toBe(1);
    expect(component.loaded).toBeTrue();
  });

  // Der Unterschied entscheidet: „nichts gefunden" ist eine Aussage über den
  // Spielplan, „nicht geladen" eine über die Verbindung. Wer beides gleich
  // darstellt, behauptet für einen Verband, es sei nichts einzurichten.
  it('unterscheidet einen Fehlschlag von einer leeren Liste', () => {
    fixture.detectChanges();
    answerLeagues();
    http
      .expectOne((req) => req.url.endsWith('admin/streaming/games'))
      .flush('kaputt', { status: 500, statusText: 'Server Error' });

    expect(component.loadError).toBeTrue();
    expect(component.games).toEqual([]);
  });

  it('wählt aus und wieder ab', () => {
    fixture.detectChanges();
    answerLeagues();
    answerGames([game(1), game(2)]);

    component.toggle(component.games[0]);
    expect(component.selected.has(1)).toBeTrue();
    expect(component.selectedGames.length).toBe(1);

    component.toggle(component.games[0]);
    expect(component.selected.size).toBe(0);
  });

  it('wählt alle aus und wieder ab', () => {
    fixture.detectChanges();
    answerLeagues();
    answerGames([game(1), game(2)]);

    component.toggleAll();
    expect(component.allSelected).toBeTrue();

    component.toggleAll();
    expect(component.selected.size).toBe(0);
  });

  it('zählt nur die auswählten Spiele mit Streamschlüssel', () => {
    fixture.detectChanges();
    answerLeagues();
    answerGames([game(1), game(2, { streamable: false, stream_key: null })]);

    component.toggleAll();

    expect(component.selected.size).toBe(2);
    expect(component.selectedStreamable).toBe(1);
  });

  // Eine Auswahl über einen Wechsel des Zuschnitts zu retten hieße, die
  // Sammelaktion liefe über Spiele, die niemand mehr sieht.
  it('leert die Auswahl beim Wechsel des Zuschnitts', () => {
    fixture.detectChanges();
    answerLeagues();
    answerGames([game(1)]);
    component.toggleAll();
    expect(component.selected.size).toBe(1);

    component.setMode('matchday');

    expect(component.selected.size).toBe(0);
    expect(component.games).toEqual([]);
  });

  // Ohne Liga gibt es nichts abzurufen -- ein Aufruf ohne sie käme als 400
  // zurück, und `http.verify()` im afterEach würde ihn hier aufdecken.
  it('fragt ohne gewählte Liga nicht ab', () => {
    fixture.detectChanges();
    answerLeagues();
    answerGames([game(1)]);

    component.setMode('matchday');
    component.load();
  });

  it('fragt mit Liga und Spieltagsnummer ab', () => {
    fixture.detectChanges();
    answerLeagues();
    answerGames([game(1)]);

    component.setMode('matchday');
    component.leagueId = 5;
    component.gameDayNumber = 3;
    component.load();

    const request = http.expectOne((req) =>
      req.url.endsWith('admin/streaming/games')
    );
    expect(request.request.params.get('league_id')).toBe('5');
    expect(request.request.params.get('game_day_number')).toBe('3');
    request.flush([]);
  });

  describe('kommendesWochenende', () => {
    // Gespielt wird am Wochenende, eingerichtet in der Woche davor. Ein
    // Vorschlag „heute bis heute" wäre an fast jedem Tag leer und sähe aus, als
    // gäbe es nichts einzurichten.
    it('schlägt von Montag aus das kommende Wochenende vor', () => {
      // Montag, 7. September 2026.
      expect(kommendesWochenende(new Date(2026, 8, 7))).toEqual([
        '2026-09-11',
        '2026-09-13',
      ]);
    });

    it('bleibt am Samstag beim laufenden Wochenende', () => {
      expect(kommendesWochenende(new Date(2026, 8, 12))).toEqual([
        '2026-09-11',
        '2026-09-13',
      ]);
    });

    it('bleibt am Sonntag beim laufenden Wochenende', () => {
      expect(kommendesWochenende(new Date(2026, 8, 13))).toEqual([
        '2026-09-11',
        '2026-09-13',
      ]);
    });

    // `toISOString` rechnet nach UTC um und lieferte in der Sommerzeit vor
    // 2 Uhr den Vortag -- das Fenster wäre dann um einen Tag verschoben.
    it('rechnet ortszeitlich, nicht in UTC', () => {
      expect(kommendesWochenende(new Date(2026, 8, 7, 0, 30))).toEqual([
        '2026-09-11',
        '2026-09-13',
      ]);
    });
  });
});
