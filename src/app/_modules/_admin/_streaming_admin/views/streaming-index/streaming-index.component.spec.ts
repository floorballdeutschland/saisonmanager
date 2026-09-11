import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  YoutubeOrphanError,
  YoutubeService,
  YoutubeStatusError,
  getTranslocoTestingModule,
} from '@floorball/core';
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
  /** Die Rümpfe aller Meldungen an den Saisonmanager, in Reihenfolge. */
  let broadcastCalls: Record<string, unknown>[];

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
    public created: {
      title: string;
      description: string;
      privacyStatus?: string;
    }[] = [];
    public bound: [string, string][] = [];
    public thumbnails: string[] = [];
    public playlisted: [string, string][] = [];
    public thumbnailFails = false;
    public bindFails = false;
    public createError: unknown = null;

    async signIn(): Promise<void> {
      this.signedIn = true;
    }

    async streamsByKey(): Promise<Map<string, { id: string }>> {
      return this.streams;
    }

    keineStreamsVorhanden(streams: Map<string, { id: string }>): boolean {
      return streams.size === 0;
    }

    async createBroadcast(input: {
      title: string;
      description: string;
      privacyStatus?: string;
    }): Promise<string> {
      if (this.createError) {
        // Wie der echte Dienst: Bei 401 ist die Anmeldung weg.
        if (
          this.createError instanceof YoutubeStatusError &&
          this.createError.status === 401
        ) {
          this.signedIn = false;
        }
        throw this.createError;
      }
      this.created.push(input);
      return `yt-${this.created.length}`;
    }

    async bind(broadcastId: string, streamId: string): Promise<void> {
      if (this.bindFails) throw new Error('bind kaputt');
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
    broadcastCalls = [];
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
   * Beantwortet, was an den Server geht, bis der übergebene Vorgang fertig ist.
   *
   * ADAPTIV UND NICHT MIT FESTER RUNDENZAHL: Der Anlegevorgang besteht aus
   * mehreren `await`s hintereinander, und wie viele Warteschleifen dazwischen
   * liegen, hängt von der Maschine ab. Eine feste Zahl bestand hier lokal und
   * fiel auf CI -- und hätte, zu hoch gewählt, stillschweigend auch dann
   * bestanden, wenn ein Aufruf gar nicht mehr kommt.
   *
   * HÄLT DIE MELDUNGEN FEST, statt sie nur wegzuwinken: Ohne `broadcastCalls`
   * kann kein Prüfsatz belegen, DASS gemeldet wurde -- und genau darauf kommt
   * es an, seit die Meldung vor dem Binden steht. `reloadWith` beantwortet die
   * Neuladung mit einer echten Liste; mit `[]` wäre jede Zusicherung auf
   * `creatable` tautologisch, weil `load()` die Auswahl ohnehin leert.
   */
  async function settle(
    lauf: Promise<unknown>,
    options: {
      reloadWith?: StreamingGame[];
      broadcastStatus?: number;
      broadcastBody?: Record<string, unknown>;
    } = {}
  ): Promise<void> {
    const { reloadWith = [], broadcastStatus, broadcastBody } = options;
    let fertig = false;
    lauf.then(
      () => (fertig = true),
      () => (fertig = true)
    );

    const antworten = () =>
      http
        .match(() => true)
        .forEach((request) => {
          if (request.request.url.includes('/broadcast')) {
            broadcastCalls.push(request.request.body);
            if (broadcastStatus) {
              request.flush(broadcastBody ?? { error: 'kaputt' }, {
                status: broadcastStatus,
                statusText: 'Fehler',
              });
            } else {
              request.flush(broadcastBody ?? {});
            }
          } else if (request.request.url.includes('leagues/')) {
            request.flush({
              id: 5,
              name: '1. FBL Herren',
              short_name: '1. FBL',
            });
          } else if (request.request.url.endsWith('admin/streaming/games')) {
            request.flush(reloadWith);
          } else {
            request.flush({});
          }
        });

    // Bis der Vorgang fertig ist -- die Obergrenze ist nur ein Riegel gegen
    // eine Endlosschleife, kein Teil der Erwartung.
    for (let i = 0; i < 200 && !fertig; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      antworten();
    }

    // Danach noch die Nachzügler: `createStreams` stößt zum Schluss ein
    // `load()` an, auf das niemand mehr wartet.
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      antworten();
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

  function game(
    id: number,
    overrides: Partial<StreamingGame> = {}
  ): StreamingGame {
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
      privacy_default: 'public',
      game_day: {
        id: 1,
        number: 1,
        date: '2026-09-12',
        league_id: 5,
        hosting_club: 'MFBC Leipzig',
        hosting_club_id: 7,
        hosting_club_unlisted: false,
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
            promote_to_public: false,
            promoted_at: null,
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
      await settle(lauf);

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
      await settle(lauf);

      expect(youtube.created).toEqual([]);
      expect(component.results.get(1)?.level).toBe('error');
      expect(component.results.get(1)?.text).toContain('Kanal');
    });

    it('legt nichts an, wenn die Anwurfzeit fehlt', async () => {
      start([game(1, { start_at: null })]);
      component.toggleAll();

      const lauf = component.createStreams();
      await settle(lauf);

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
      await settle(lauf);

      expect(youtube.bound.length).toBe(1);
      expect(component.results.get(1)?.level).toBe('warning');
      expect(component.results.get(1)?.text).toContain('Thumbnail');
    });

    // Ein erschöpftes Kontingent ist ein Zustand: Ab da scheitert alles Weitere.
    // Weiterzulaufen erzeugte nur N identische Fehlzeilen.
    it('bricht den Stapel bei erschöpftem Kontingent ab', async () => {
      youtube.createError = new YoutubeStatusError(
        403,
        'Das YouTube-Tageskontingent ist erschöpft.',
        'quotaExceeded'
      );
      start([game(1), game(2), game(3)]);
      component.toggleAll();

      const lauf = component.createStreams();
      await settle(lauf, { reloadWith: [game(1)] });

      expect(component.results.size).toBe(1);
    });

    // `forbidden` enthält keines der früher gesuchten Schlüsselwörter -- die
    // Prüfung auf übersetzte Prosa hätte hier weiterlaufen lassen.
    it('bricht auch bei fehlenden Rechten ab', async () => {
      youtube.createError = new YoutubeStatusError(
        403,
        'Dieses Konto darf auf dem Kanal nichts anlegen.',
        'forbidden'
      );
      start([game(1), game(2)]);
      component.toggleAll();

      const lauf = component.createStreams();
      await settle(lauf, { reloadWith: [game(1)] });

      expect(component.results.size).toBe(1);
    });

    // Die Übertragung EXISTIERT, nur ihre Kennung ist verloren. Ein zweiter
    // Anlauf legte eine zweite auf demselben Schlüssel an.
    it('sperrt ein Spiel, dessen Übertragung ohne Kennung entstanden ist', async () => {
      youtube.createError = new YoutubeOrphanError('ohne Kennung angelegt');
      start([game(1)]);
      component.toggleAll();

      const lauf = component.createStreams();
      await settle(lauf, { reloadWith: [game(1)] });

      expect(component.results.get(1)?.level).toBe('error');
      expect(component.results.get(1)?.text).toContain('nachsehen');
      component.toggleAll();
      expect(component.creatable).toEqual([]);
    });

    // Der Satz IST vermerkt, nur am falschen Spiel. „Nicht vermerkt" wäre eine
    // Falschaussage, und die Ursache (kopierte Kennung) bliebe verborgen.
    it('unterscheidet einen Zuordnungskonflikt von einer fehlgeschlagenen Meldung', async () => {
      start([game(1)]);
      component.toggleAll();

      const lauf = component.createStreams();
      await settle(lauf, {
        reloadWith: [game(1)],
        broadcastStatus: 409,
        broadcastBody: {
          error:
            'Diese Übertragung ist bereits einem anderen Spiel zugeordnet.',
        },
      });

      const text = component.results.get(1)?.text ?? '';
      expect(text).toContain('bereits einem anderen Spiel zugeordnet');
      expect(text).not.toContain('nicht vermerkt');
    });

    // „Warum steht im Spielplan kein Link" ist sonst von außen nicht zu
    // beantworten -- der Server begründet es, und die Zeile sagt es weiter.
    it('nennt den Grund, wenn kein Link im Spielplan landet', async () => {
      start([game(1)]);
      component.toggleAll();

      const lauf = component.createStreams();
      await settle(lauf, {
        reloadWith: [game(1)],
        broadcastBody: {
          link_written: false,
          link_skipped_reason: 'am Spiel steht bereits ein Link',
        },
      });

      expect(component.results.get(1)?.text).toContain(
        'am Spiel steht bereits ein Link'
      );
    });

    it('ohne Google-Zugang steht das Anlegen nicht zur Verfügung', () => {
      youtube.configured = false;
      start([game(1)]);

      expect(component.youtubeReady).toBeFalse();
    });

    // Der teuerste Fall überhaupt: Die Übertragung existiert, der Saisonmanager
    // weiß nichts davon, der Wächter beendet sie nie -- und ein zweiter Klick
    // legte eine weitere an. Das darf keine grüne Erfolgsmeldung sein.
    it('meldet eine nicht vermerkte Übertragung als Fehler, nicht als Erfolg', async () => {
      start([game(1)]);
      component.toggleAll();

      const lauf = component.createStreams();
      await settle(lauf, { reloadWith: [game(1)], broadcastStatus: 500 });

      expect(youtube.created.length).toBe(1);
      expect(broadcastCalls.length).toBeGreaterThan(0);
      expect(component.results.get(1)?.level).toBe('error');
      expect(component.results.get(1)?.text).toContain('yt-1');
    });

    // Zweiter Riegel neben `game.broadcast`: Nach einer gescheiterten Meldung
    // weiß die neu geladene Liste nichts von der Übertragung.
    // Die Neuladung liefert das Spiel UNVERÄNDERT zurück (ohne `broadcast`) --
    // so wie es käme, wenn die Meldung an den Server gescheitert ist. Nur dann
    // belegt der Prüfsatz wirklich den Riegel `_angelegt`: Mit einer leeren
    // Liste wäre `creatable` ohnehin leer, weil `load()` die Auswahl räumt.
    it('bietet ein Spiel nach dem Anlegen nicht erneut an', async () => {
      start([game(1)]);
      component.toggleAll();

      const lauf = component.createStreams();
      await settle(lauf, { reloadWith: [game(1)], broadcastStatus: 500 });

      expect(youtube.created.length).toBe(1);
      // Der Server weiß nichts von der Übertragung, das Spiel steht wieder
      // ohne `broadcast` in der Liste -- trotzdem darf es nicht erneut
      // angeboten werden.
      component.toggleAll();
      expect(component.selected.size).toBe(1);
      expect(component.creatable).toEqual([]);
    });

    // Scheitert das Binden, existiert die Übertragung schon -- sie ist gemeldet
    // und darf nicht als "nicht angelegt" dastehen.
    // DIE REIHENFOLGE IST DER FIX: gemeldet wird VOR dem Binden. Ohne diesen
    // Prüfsatz bliebe eine Rückkehr zu "erst binden, dann melden" unbemerkt --
    // und dann wäre die Übertragung nach einem Bind-Fehlschlag wieder eine
    // Waise, die der Wächter nie beendet.
    it('meldet die Übertragung, BEVOR sie gebunden wird', async () => {
      youtube.bindFails = true;
      start([game(1)]);
      component.toggleAll();

      const lauf = component.createStreams();
      await settle(lauf, { reloadWith: [game(1)] });

      expect(youtube.created.length).toBe(1);
      // Trotz gescheitertem Binden ist die Meldung raus -- genau einmal, denn
      // die zweite (den Link freigebende) unterbleibt ohne Bindung.
      expect(broadcastCalls.length).toBe(1);
      expect(broadcastCalls[0]['bound']).toBeFalse();
      expect(component.results.get(1)?.text).toContain(
        'nicht an den Stream gebunden'
      );
      // Ungebunden heißt: empfängt nie Signal, wird vom Wächter übersprungen.
      expect(component.results.get(1)?.level).toBe('error');
    });

    // Der Link darf erst in den öffentlichen Spielplan, wenn die Übertragung
    // gebunden ist -- sonst steht dort ein Link auf eine Sendung ohne Signal.
    it('gibt den Link erst nach dem Binden frei', async () => {
      start([game(1)]);
      component.toggleAll();

      const lauf = component.createStreams();
      await settle(lauf, { reloadWith: [game(1)] });

      expect(broadcastCalls.length).toBe(2);
      expect(broadcastCalls[0]['bound']).toBeFalse();
      expect(broadcastCalls[1]['bound']).toBeTrue();
      expect(youtube.bound.length).toBe(1);
    });

    // Sonst bekäme jedes Spiel "Streamschlüssel nicht vorhanden" -- eine
    // Meldung, die die Vereinsdaten beschuldigt, obwohl der Kanalzugang schuld ist.
    it('meldet einen Kanal ohne Streamschlüssel einmal statt je Spiel', async () => {
      youtube.streams = new Map();
      start([game(1), game(2)]);
      component.toggleAll();

      const lauf = component.createStreams();
      await settle(lauf);

      expect(youtube.created).toEqual([]);
      expect(component.results.size).toBe(0);
    });

    // Ohne geladene Vorlage entstünden titellose Übertragungen auf dem
    // Verbandskanal.
    it('legt ohne geladene Titelvorlage nichts an', async () => {
      fixture.detectChanges();
      answerLeagues();
      http
        .expectOne((req) => req.url.endsWith('admin/streaming/settings'))
        .flush('kaputt', { status: 500, statusText: 'Server Error' });
      answerGames([game(1)]);
      component.toggleAll();

      expect(component.templatesFailed).toBeTrue();
      expect(component.canCreate).toBeFalse();

      await component.createStreams();

      expect(youtube.created).toEqual([]);
    });

    // Wer mitten im Stapel umstellt, meldete dem Server sonst `public` für eine
    // ungelistete Übertragung -- und der schreibt ihren Link in den
    // öffentlichen Spielplan, wo er tot ist.
    it('friert die Sichtbarkeit für den ganzen Lauf ein', async () => {
      start([game(1)]);
      component.toggleAll();
      component.privacy = 'unlisted';

      const lauf = component.createStreams();
      component.privacy = 'public';
      await settle(lauf, { reloadWith: [game(1)] });

      expect(broadcastCalls.length).toBeGreaterThan(0);
      expect(
        broadcastCalls.every((body) => body['privacy_status'] === 'unlisted')
      ).toBeTrue();
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
  // Ein paar Vereine senden ihre Heimspiele selbst. Ihnen wurde zugesagt, dass
  // unsere Übertragung währenddessen nicht gelistet läuft -- und danach
  // öffentlich wird. Die Zusage darf die Einstellung oben nur in EINE Richtung
  // schlagen.
  describe('Zusage des Ausrichters', () => {
    function mitZusage(id: number) {
      return game(id, {
        game_day: {
          ...game(id).game_day!,
          hosting_club_unlisted: true,
        },
        privacy_default: 'unlisted' as const,
      });
    }

    it('legt ein Spiel mit Zusage nicht gelistet an, obwohl oben öffentlich steht', async () => {
      start([mitZusage(1)]);
      component.privacy = 'public';
      component.toggleAll();

      await settle(component.createStreams());

      expect(youtube.created[0].privacyStatus).toBe('unlisted');
    });

    // Die Gegenrichtung: „nicht gelistet" oben meint den ganzen Lauf.
    it('nimmt ein Spiel ohne Zusage mit, wenn oben nicht gelistet steht', async () => {
      start([game(1)]);
      component.privacy = 'unlisted';
      component.toggleAll();

      await settle(component.createStreams());

      expect(youtube.created[0].privacyStatus).toBe('unlisted');
    });

    it('lässt ein Spiel ohne Zusage öffentlich', async () => {
      start([game(1)]);
      component.privacy = 'public';
      component.toggleAll();

      await settle(component.createStreams());

      expect(youtube.created[0].privacyStatus).toBe('public');
    });

    it('zählt, wie viele des Laufs nicht gelistet laufen', () => {
      start([mitZusage(1), game(2)]);
      component.toggleAll();

      expect(component.unlistedCount).toBe(1);
    });

    it('lädt die Pflegeliste erst beim Aufklappen', async () => {
      start([game(1)]);

      http.expectNone(`${environment.apiURL}admin/streaming/hosts`);

      const lauf = component.toggleHosts();
      http.expectOne(`${environment.apiURL}admin/streaming/hosts`).flush([
        {
          id: 7,
          name: 'MFBC Leipzig',
          short_name: 'MFBC',
          stream_default_unlisted: false,
        },
      ]);
      await lauf;

      expect(component.hosts.length).toBe(1);
    });

    // Beide Meldungen an den Server müssen dieselbe Sichtbarkeit tragen wie das
    // tatsächlich Angelegte. Trügen sie „public", setzte der Server die Zusage
    // nicht -- und schriebe zusätzlich den Link einer ungelisteten Übertragung
    // in den öffentlichen Spielplan, wo er tot ist.
    it('meldet dem Server dieselbe Sichtbarkeit, mit der angelegt wurde', async () => {
      start([mitZusage(1)]);
      component.privacy = 'public';
      component.toggleAll();

      await settle(component.createStreams());

      expect(broadcastCalls.length).toBe(2);
      for (const koerper of broadcastCalls) {
        expect(koerper['privacy_status']).toBe('unlisted');
      }
    });

    // Der Browser hat das Kästchen bereits umgeschaltet. Bleibt der gebundene
    // Wert unverändert, zeigt die Liste eine Zusage, die der Server nicht hat --
    // und wer sich darauf verlässt, legt öffentlich an.
    it('dreht den Haken zurück, wenn das Speichern scheitert', async () => {
      start([game(1)]);
      const host = {
        id: 7,
        name: 'MFBC Leipzig',
        short_name: 'MFBC',
        stream_default_unlisted: false,
      };

      const lauf = component.setHost(host, true);
      http
        .expectOne(`${environment.apiURL}admin/streaming/hosts/7`)
        .flush('kaputt', { status: 500, statusText: 'Server Error' });
      await lauf;

      expect(host.stream_default_unlisted).toBeFalse();
    });

    it('übernimmt den Wert aus der Antwort und lädt die Liste neu', async () => {
      start([game(1)]);
      const host = {
        id: 7,
        name: 'MFBC Leipzig',
        short_name: 'MFBC',
        stream_default_unlisted: false,
      };

      const lauf = component.setHost(host, true);
      http.expectOne(`${environment.apiURL}admin/streaming/hosts/7`).flush({
        ...host,
        stream_default_unlisted: true,
      });
      await lauf;

      expect(host.stream_default_unlisted).toBeTrue();
      // Die Sichtbarkeitsspalte stammt aus derselben Angabe.
      http.expectOne((request) =>
        request.url.includes('admin/streaming/games')
      );
    });

    // Eine leere Liste wäre von einem fehlgeschlagenen Abruf nicht zu
    // unterscheiden -- und wer daraufhin eine Zusage für nicht gesetzt hält,
    // legt öffentlich an.
    it('meldet einen fehlgeschlagenen Abruf der Pflegeliste', async () => {
      start([game(1)]);

      const lauf = component.toggleHosts();
      http
        .expectOne(`${environment.apiURL}admin/streaming/hosts`)
        .flush('kaputt', { status: 500, statusText: 'Server Error' });
      await lauf;

      expect(component.hostsError).toBeTrue();
      expect(component.hosts).toEqual([]);
    });
  });
});
