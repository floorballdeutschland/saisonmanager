import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { environment } from 'src/environments/environment';

import {
  YoutubeError,
  YoutubeService,
  YoutubeStatusError,
  youtubeGrundText,
} from './youtube.service';

/**
 * Der Dienst benutzt das globale `fetch`, kein `HttpClient` -- ein Spion darauf
 * genügt. Geprüft wird die Auswertung der Antworten: Sie ist der Vertrag, auf
 * dem der ganze Anlegevorgang steht, und der Fake im Komponententest baut ihn
 * von Hand nach. Stimmen beide nicht überein, sind beide grün und trotzdem falsch.
 */
describe('YoutubeService', () => {
  let service: YoutubeService;
  let antworten: Response[];
  let aufrufe: { url: string; init?: RequestInit }[];

  function response(body: unknown, status = 200): Response {
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => (body === null ? '' : JSON.stringify(body)),
    } as Response;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(YoutubeService);
    antworten = [];
    aufrufe = [];
    spyOn(window, 'fetch').and.callFake(
      async (url: RequestInfo | URL, init?: RequestInit) => {
        aufrufe.push({ url: String(url), init });
        const naechste = antworten.shift();
        if (!naechste) throw new Error(`Unerwarteter Aufruf: ${url}`);
        return naechste;
      }
    );
    // Angemeldet, ohne den Google-Dialog zu bemühen.
    (service as unknown as { _token: string })._token = 'token-123';
  });

  describe('configured', () => {
    // In der Entwicklung ist die Kennung leer -- der gewollte Zustand.
    it('ist ohne Kennung falsch', () => {
      expect(service.configured).toBeFalse();
    });

    // Der Platzhalter überlebt einen Bau ohne hinterlegte Kennung. Er ist keine
    // gültige Client-ID und darf nicht als "eingerichtet" durchgehen -- sonst
    // liefe der Anwender in einen Anmeldedialog, den Google abweist.
    it('erkennt den unersetzten Platzhalter nicht als eingerichtet', () => {
      const vorher = environment.googleClientId;
      environment.googleClientId = 'GOOGLE_CLIENT_ID_PLACEHOLDER';

      expect(service.configured).toBeFalse();

      environment.googleClientId = vorher;
    });

    it('gilt mit einer echten Kennung als eingerichtet', () => {
      const vorher = environment.googleClientId;
      environment.googleClientId = '123-abc.apps.googleusercontent.com';

      expect(service.configured).toBeTrue();

      environment.googleClientId = vorher;
    });
  });

  describe('streamsByKey', () => {
    it('bildet Schlüssel auf die Stream-Ressource ab', async () => {
      antworten.push(
        response({
          items: [
            {
              id: 'stream-1',
              snippet: { title: 'MFBC' },
              cdn: { ingestionInfo: { streamName: 'abcd-efgh' } },
            },
          ],
        })
      );

      const streams = await service.streamsByKey();

      expect(streams.get('abcd-efgh')).toEqual({
        id: 'stream-1',
        title: 'MFBC',
      });
    });

    // Der Kanal führt je Verein einen dauerhaften Schlüssel; 50 sind schnell
    // erreicht. Bricht das Blättern, meldet die Oberfläche für jedes Spiel
    // jenseits der ersten Seite "Streamschlüssel nicht vorhanden" -- eine
    // plausibel aussehende Falschaussage.
    it('blättert über alle Seiten', async () => {
      antworten.push(
        response({
          nextPageToken: 'seite-2',
          items: [{ id: 's1', cdn: { ingestionInfo: { streamName: 'aaaa' } } }],
        }),
        response({
          items: [{ id: 's2', cdn: { ingestionInfo: { streamName: 'bbbb' } } }],
        })
      );

      const streams = await service.streamsByKey();

      expect(streams.size).toBe(2);
      expect(aufrufe[1].url).toContain('pageToken=seite-2');
    });

    it('überspringt einen Eintrag ohne Schlüssel, statt zu scheitern', async () => {
      antworten.push(response({ items: [{ id: 's1', cdn: {} }] }));

      expect((await service.streamsByKey()).size).toBe(0);
    });
  });

  describe('ensurePlaylist', () => {
    it('findet eine vorhandene Playlist unabhängig von der Schreibweise', async () => {
      antworten.push(
        response({
          items: [{ id: 'pl-1', snippet: { title: '1. FBL HERREN' } }],
        })
      );

      expect(await service.ensurePlaylist('1. fbl herren')).toBe('pl-1');
      expect(aufrufe.length).toBe(1);
    });

    // Ein Fehlgriff erzeugt bei jedem Durchgang eine neue öffentliche Playlist
    // auf dem Verbandskanal.
    it('legt nur an, wenn keine passt', async () => {
      antworten.push(response({ items: [] }), response({ id: 'pl-neu' }));

      expect(await service.ensurePlaylist('Neue Liga')).toBe('pl-neu');
      expect(aufrufe[1].init?.method).toBe('POST');
    });
  });

  describe('createBroadcast', () => {
    const eingabe = {
      title: 'A vs B',
      description: 'Text',
      scheduledStartTime: '2026-09-12T18:00:00+02:00',
      privacyStatus: 'public' as const,
    };

    it('gibt die Kennung zurück', async () => {
      antworten.push(response({ id: 'yt-1' }));

      expect(await service.createBroadcast(eingabe)).toBe('yt-1');
    });

    // Ohne Kennung liefe eine leere Zeichenkette in `bind('')` weiter -- die
    // Übertragung existiert dann, ihre Kennung ist verloren.
    it('scheitert, wenn die Antwort keine Kennung trägt', async () => {
      antworten.push(response({}));

      await expectAsync(service.createBroadcast(eingabe)).toBeRejectedWithError(
        YoutubeError
      );
    });

    it('bindet die Übertragung nicht automatisch an einen Stream', async () => {
      antworten.push(response({ id: 'yt-1' }));
      await service.createBroadcast(eingabe);

      expect(aufrufe.length).toBe(1);
    });
  });

  describe('Fehlerbehandlung', () => {
    it('macht aus einem Kontingentfehler einen deutschen Handlungssatz', async () => {
      antworten.push(
        response({ error: { errors: [{ reason: 'quotaExceeded' }] } }, 403)
      );

      await expectAsync(service.streamsByKey()).toBeRejectedWith(
        jasmine.objectContaining({
          status: 403,
          message: jasmine.stringContaining('Tageskontingent'),
        })
      );
    });

    it('unterscheidet fehlende Rechte vom Kontingent', () => {
      expect(youtubeGrundText('forbidden')).toContain(
        'darf auf dem Kanal nichts anlegen'
      );
      expect(youtubeGrundText('quotaExceeded')).toContain('Tageskontingent');
      expect(youtubeGrundText('unbekannt')).toBeNull();
    });

    // Sonst stünde "Unexpected token < in JSON…" in der Ergebniszeile.
    it('macht aus einer unlesbaren Antwort einen YoutubeStatusError', async () => {
      antworten.push({
        ok: true,
        status: 200,
        text: async () => '<html>kaputt',
      } as Response);

      await expectAsync(service.streamsByKey()).toBeRejectedWithError(
        YoutubeStatusError
      );
    });

    // Ohne das Verwerfen liefe jeder Folgeaufruf in dieselbe 401.
    it('verwirft das Token bei 401', async () => {
      antworten.push(
        response({ error: { errors: [{ reason: 'authError' }] } }, 401)
      );

      await expectAsync(service.streamsByKey()).toBeRejected();
      expect(service.signedIn).toBeFalse();
    });
  });

  describe('uploadThumbnail', () => {
    const blob = new Blob(['x'], { type: 'image/png' });

    it('lädt das Bild hoch', async () => {
      antworten.push(response({}));

      await service.uploadThumbnail('yt-1', blob);

      expect(aufrufe[0].url).toContain('/upload/youtube/v3/thumbnails');
      expect(aufrufe[0].url).toContain('videoId=yt-1');
    });

    // Kurz nach dem Anlegen kennt die Video-Schnittstelle die Übertragung
    // gelegentlich noch nicht. Das bisherige Python-Skript wartete dafür
    // pauschal zehn Sekunden je Bild.
    it('wiederholt bei 404 und kommt im dritten Anlauf durch', fakeAsync(async () => {
      antworten.push(response({}, 404), response({}, 404), response({}));

      const lauf = service.uploadThumbnail('yt-1', blob);
      tick(2000);
      tick(4000);
      await lauf;

      expect(aufrufe.length).toBe(3);
    }));

    // Ein 403 zu wiederholen verdreifachte nur den Kontingentverbrauch.
    it('wiederholt einen Rechtefehler nicht', fakeAsync(async () => {
      antworten.push(
        response({ error: { errors: [{ reason: 'forbidden' }] } }, 403)
      );

      const lauf = service.uploadThumbnail('yt-1', blob);
      await expectAsync(lauf).toBeRejected();

      expect(aufrufe.length).toBe(1);
    }));
  });
});
