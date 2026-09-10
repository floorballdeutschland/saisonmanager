import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { YoutubeService, getTranslocoTestingModule } from '@floorball/core';
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
  let youtube: FakeYoutube;

  /**
   * Ersetzt den echten YouTube-Zugang. Hält fest, was angelegt worden wäre --
   * die Prüfsätze sollen die Reihenfolge und die Fehlerbehandlung belegen, nicht
   * die Schnittstelle von Google.
   */
  class FakeYoutube {
    public configured = true;
    public signedIn = false;
    public streams = new Map<string, { id: string }>([
      ['abcd-efgh', { id: 'stream-1' }],
    ]);
    public created: { title: string; description: string }[] = [];
    public bound: [string, string][] = [];
    public thumbnails: string[] = [];
    public playlisted: [string, string][] = [];
    public thumbnailFails = false;

    async signIn(): Promise<void> {
      this.signedIn = true;
    }

    async streamsByKey(): Promise<Map<string, { id: string }>> {
      return this.streams;
    }

    async createBroadcast(input: {
      title: string;
      description: string;
    }): Promise<string> {
      this.created.push(input);
      return `yt-${this.created.length}`;
    }

    async bind(broadcastId: string, streamId: string): Promise<void> {
      this.bound.push([broadcastId, streamId]);
    }

    async uploadThumbnail(broadcastId: string): Promise<void> {
      if (this.thumbnailFails) throw new Error('kaputt');
      this.thumbnails.push(broadcastId);
    }

    async ensurePlaylist(name: string): Promise<string> {
      return `playlist-${name}`;
    }

    async addToPlaylist(playlistId: string, videoId: string): Promise<void> {
      this.playlisted.push([playlistId, videoId]);
    }
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        CommonModule,
        FormsModule,
        HttpClientTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [StreamingIndexComponent],
      providers: [{ provide: YoutubeService, useClass: FakeYoutube }],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    youtube = TestBed.inject(YoutubeService) as unknown as FakeYoutube;
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

  /** Beantwortet den Vorlagenabruf, der ebenfalls bei jedem Start läuft. */
  function answerTemplates(): void {
    http.expectOne(`${environment.apiURL}admin/streaming/settings`).flush({
      title: '{heim} vs {gast} | {liga}',
      description: '{liga} – {spieltag}. Spieltag',
      default_title: '{heim} vs {gast}',
      default_description: '{liga}',
    });
  }

  /**
   * Lässt die angefangenen Zusagen weiterlaufen und beantwortet unterwegs alles,
   * was an den Server geht. Der Anlauf besteht aus mehreren `await`s
   * nacheinander; ohne diese Schleife stünde er nach dem ersten still.
   */
  async function drain(runden = 12): Promise<void> {
    for (let i = 0; i < runden; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      http.match(() => true).forEach((request) => {
        if (request.request.url.includes('leagues/')) request.flush(null);
        else if (request.request.url.endsWith('admin/streaming/games')) request.flush([]);
        else request.flush({});
      });
    }
  }

  function answerGames(games: StreamingGame[]): void {
    const request = http.expectOne((req) =>
      req.url.endsWith('admin/streaming/games')
    );
    request.flush(games);
  }

  function start(games: StreamingGame[]): void {
    fixture.detectChanges();
    answerLeagues();
    answerTemplates();
    answerGames(games);
  }

  function game(id: number, overrides: Partial<StreamingGame> = {}): StreamingGame {
    return {
      id,
      game_number: String(id),
      start_time: '18:00',
      start_at: `2026-09-12T18:00:00+02:00`,
      home_team_name: 'MFBC Leipzig',
      guest_team_name: 'Floor Fighters Chemnitz',
      public_url: `https://saisonmanager.de/fd/5/spiel/${id}`,
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
    answerTemplates();

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
    answerTemplates();
    http
      .expectOne((req) => req.url.endsWith('admin/streaming/games'))
      .flush('kaputt', { status: 500, statusText: 'Server Error' });

    expect(component.loadError).toBeTrue();
    expect(component.games).toEqual([]);
  });

  it('wählt aus und wieder ab', () => {
    fixture.detectChanges();
    answerLeagues();
    answerTemplates();
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
    answerTemplates();
    answerGames([game(1), game(2)]);

    component.toggleAll();
    expect(component.allSelected).toBeTrue();

    component.toggleAll();
    expect(component.selected.size).toBe(0);
  });

  it('zählt nur die auswählten Spiele mit Streamschlüssel', () => {
    fixture.detectChanges();
    answerLeagues();
    answerTemplates();
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
    answerTemplates();
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
    answerTemplates();
    answerGames([game(1)]);

    component.setMode('matchday');
    component.load();
  });

  it('fragt mit Liga und Spieltagsnummer ab', () => {
    fixture.detectChanges();
    answerLeagues();
    answerTemplates();
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

  describe('Übertragungen anlegen', () => {
    // Zwei Riegel gegen ein zweites Anlegen: Was schon eine Übertragung hat,
    // und was gar keinen Schlüssel hat, steht nicht zur Auswahl. Der erste ist
    // der wichtigere -- das YouTube-Kontingent ist verbraucht, sobald der
    // Server davon erfährt.
    it('legt weder für ein Spiel ohne Schlüssel noch für ein bereits angelegtes an', () => {
      start([
        game(1),
        game(2, { streamable: false, stream_key: null }),
        game(3, {
          broadcast: {
            broadcast_id: 'yt-alt',
            watch_url: 'https://youtu.be/yt-alt',
            created_at: '2026-09-01T10:00:00Z',
            ended_at: null,
            ended_reason: null,
          },
        }),
      ]);
      component.toggleAll();

      expect(component.selected.size).toBe(3);
      expect(component.creatable.map((entry) => entry.id)).toEqual([1]);
    });

    it('legt an, bindet, meldet und trägt in die Playlist ein', async () => {
      start([
        game(1, {
          league: {
            id: 5,
            name: '1. FBL Herren',
            short_name: '1. FBL',
            stream_playlist: '1. FBL Herren 26/27',
          },
        }),
      ]);
      component.toggleAll();

      const lauf = component.createStreams();
      await drain();
      await lauf;

      expect(youtube.signedIn).toBeTrue();
      expect(youtube.created.length).toBe(1);
      expect(youtube.created[0].title).toBe(
        'MFBC Leipzig vs Floor Fighters Chemnitz | 1. FBL Herren'
      );
      expect(youtube.bound).toEqual([['yt-1', 'stream-1']]);
      expect(youtube.playlisted).toEqual([
        ['playlist-1. FBL Herren 26/27', 'yt-1'],
      ]);
      expect(component.results.get(1)?.level).toBe('success');
    });

    // Ohne diesen Riegel entstünde eine Übertragung, die an nichts gebunden ist
    // und auf die niemand senden kann.
    it('legt nichts an, wenn der Schlüssel auf dem Kanal fehlt', async () => {
      start([game(1, { stream_key: 'unbekannt' })]);
      component.toggleAll();

      const lauf = component.createStreams();
      await drain();
      await lauf;

      expect(youtube.created).toEqual([]);
      expect(component.results.get(1)?.level).toBe('error');
      expect(component.results.get(1)?.text).toContain('Kanal');
    });

    it('legt nichts an, wenn die Anwurfzeit fehlt', async () => {
      start([game(1, { start_at: null })]);
      component.toggleAll();

      const lauf = component.createStreams();
      await drain();
      await lauf;

      expect(youtube.created).toEqual([]);
      expect(component.results.get(1)?.level).toBe('error');
    });

    // Thumbnail und Playlist sind Beiwerk: Die Übertragung existiert, ist
    // gebunden und gemeldet -- das darf nicht als Fehlschlag dastehen, sonst
    // legt jemand sie ein zweites Mal an.
    it('meldet einen Fehlschlag beim Thumbnail als Warnung, nicht als Fehler', async () => {
      youtube.thumbnailFails = true;
      start([game(1)]);
      component.toggleAll();

      const lauf = component.createStreams();
      await drain();
      await lauf;

      expect(youtube.bound.length).toBe(1);
      expect(component.results.get(1)?.level).toBe('warning');
      expect(component.results.get(1)?.text).toContain('Thumbnail');
    });

    it('ohne Google-Zugang steht das Anlegen nicht zur Verfügung', () => {
      youtube.configured = false;
      start([game(1)]);

      expect(component.youtubeReady).toBeFalse();
    });
  });

  describe('Vorlagen', () => {
    it('übernimmt die gespeicherten Vorlagen und zeigt eine Vorschau', () => {
      start([game(1)]);
      component.toggleAll();

      expect(component.titleTemplate).toBe('{heim} vs {gast} | {liga}');
      expect(component.titlePreview).toBe(
        'MFBC Leipzig vs Floor Fighters Chemnitz | 1. FBL Herren'
      );
    });

    it('stellt die Vorgabe wieder her', () => {
      start([game(1)]);

      component.resetTemplates();

      expect(component.titleTemplate).toBe('{heim} vs {gast}');
    });

    it('speichert die Vorlagen', () => {
      start([game(1)]);
      component.titleTemplate = '{liga}: {heim}';

      component.saveTemplates();

      const request = http.expectOne(
        `${environment.apiURL}admin/streaming/settings`
      );
      expect(request.request.method).toBe('PUT');
      expect(request.request.body.title).toBe('{liga}: {heim}');
      request.flush({
        title: '{liga}: {heim}',
        description: 'x',
        default_title: 'y',
        default_description: 'z',
      });
    });
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
