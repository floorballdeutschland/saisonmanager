import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { NotificationService } from '@floorball/core';

import {
  ThumbnailBatchComponent,
  ThumbnailBatchGame,
  ThumbnailBatchGameDayWithGames,
} from './thumbnail-batch.component';

describe('ThumbnailBatchComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<ThumbnailBatchComponent>;
  let component: ThumbnailBatchComponent;
  let messages: { level: string; text: string }[];
  /** Was der Browser zum Ablegen bekam: Name der Datei und ihr Inhalt. */
  let saved: { name: string; blob: Blob }[];
  /** Lässt `saveBlob` scheitern, wie ein blockierter Download es täte. */
  let clickThrows = false;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommonModule, HttpClientTestingModule],
      declarations: [ThumbnailBatchComponent],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);

    messages = [];
    const notifications = TestBed.inject(NotificationService);
    for (const level of ['success', 'warning', 'error'] as const) {
      spyOn(notifications, level).and.callFake((text: string) =>
        messages.push({ level, text })
      );
    }

    // Geprüft wird am Klick auf den Anker mit `download`-Attribut: Dort steht
    // genau das, was im Download-Ordner gelandet wäre. `createObjectURL` muss
    // mit ersetzt werden, um an den Blob zu kommen.
    saved = [];
    clickThrows = false;
    let pending: Blob | null = null;
    spyOn(URL, 'createObjectURL').and.callFake((blob: Blob | MediaSource) => {
      pending = blob as Blob;
      return 'blob:test';
    });
    spyOn(URL, 'revokeObjectURL');
    spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (
      this: HTMLAnchorElement
    ) {
      if (clickThrows) throw new Error('Download blockiert.');
      saved.push({ name: this.download, blob: pending as Blob });
    });

    fixture = TestBed.createComponent(ThumbnailBatchComponent);
    component = fixture.componentInstance;
  });

  function game(
    overrides: Partial<ThumbnailBatchGame> = {}
  ): ThumbnailBatchGame {
    return {
      start_time: '18:00',
      home_team_name: 'UHC Sparkasse Weißenfels',
      guest_team_name: 'MFBC Grimma',
      ...overrides,
    };
  }

  const secondGame = game({
    start_time: '20:15',
    home_team_name: 'MFBC Leipzig',
    guest_team_name: 'Red Devils Wernigerode',
  });

  const league = {
    id: 42,
    name: '2. Floorball-Bundesliga Herren',
    league_class_id: '2fbl',
    league_type: 'league',
    female: false,
  };

  function gameDay(
    games: ThumbnailBatchGame[]
  ): ThumbnailBatchGameDayWithGames {
    return {
      number: 3,
      date: '2026-01-11',
      league_id: 42,
      arena: { name: 'Stadtbadhalle' },
      games,
    };
  }

  function create(games: ThumbnailBatchGame[]): void {
    component.gameDay = gameDay(games);
    fixture.detectChanges();
  }

  /** Der Durchgang samt Ligaabruf; `null` beantwortet ihn mit einem Fehler. */
  async function run(response: object | null = league): Promise<void> {
    const running = component.download();

    // Der Riegel gegen einen zweiten Durchgang muss greifen, solange der erste
    // läuft -- geprüft hier, wo der Zustand sichtbar ist, statt über einen
    // Jasmine-Zeitablauf.
    expect(component.busy).toBeTrue();

    const request = http.expectOne((req) => req.url.indexOf('leagues/42') >= 0);
    if (response) {
      request.flush(response);
    } else {
      request.error(new ProgressEvent('error'));
    }

    await running;
    expect(component.busy).toBeFalse();
  }

  /**
   * Liest das Archiv über das zentrale Verzeichnis, so wie es jeder Packer tut.
   *
   * Nicht über eine Textsuche im Blob: Die findet einen Namen auch dann, wenn er
   * in einem Ordner steckt, sie liefert ihn doppelt (lokaler Kopfsatz und
   * Verzeichnis) und sie sagt nichts über den Inhalt. Damit ließe sich weder die
   * Anzahl noch die Reihenfolge noch „ist das überhaupt ein Bild" prüfen.
   */
  async function readZip(
    blob: Blob
  ): Promise<{ name: string; data: Uint8Array }[]> {
    const buffer = await blob.arrayBuffer();
    const view = new DataView(buffer);
    const decoder = new TextDecoder('utf-8');
    const end = view.byteLength - 22;

    expect(view.getUint32(end, true)).toBe(0x06054b50);

    const count = view.getUint16(end + 10, true);
    let cursor = view.getUint32(end + 16, true);
    const entries: { name: string; data: Uint8Array }[] = [];

    for (let index = 0; index < count; index++) {
      expect(view.getUint32(cursor, true)).toBe(0x02014b50);

      const size = view.getUint32(cursor + 24, true);
      const nameLength = view.getUint16(cursor + 28, true);
      const extraLength = view.getUint16(cursor + 30, true);
      const commentLength = view.getUint16(cursor + 32, true);
      const localOffset = view.getUint32(cursor + 42, true);
      const name = decoder.decode(
        new Uint8Array(buffer, cursor + 46, nameLength)
      );
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);

      entries.push({
        name,
        data: new Uint8Array(
          buffer,
          localOffset + 30 + localNameLength + localExtraLength,
          size
        ),
      });

      cursor += 46 + nameLength + extraLength + commentLength;
    }

    return entries;
  }

  /** Ist der Eintrag ein PNG? Ein leeres Bild bestünde jede Namensprüfung. */
  function isPng(data: Uint8Array): boolean {
    return (
      data.length > 8 &&
      data[0] === 0x89 &&
      data[1] === 0x50 &&
      data[2] === 0x4e &&
      data[3] === 0x47
    );
  }

  /** Lässt den n-ten Zeichenauftrag scheitern; alle anderen laufen echt. */
  function breakRender(...failing: number[]): void {
    const real = HTMLCanvasElement.prototype.toBlob;
    let call = 0;

    spyOn(HTMLCanvasElement.prototype, 'toBlob').and.callFake(function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
      type?: string
    ) {
      call += 1;
      if (failing.includes(call)) {
        callback(null);
        return;
      }
      real.call(this, callback, type);
    });
  }

  /** Sammelt allen Text, der in die Leinwand geschrieben wird. */
  function captureText(): string[] {
    const texts: string[] = [];
    spyOn(CanvasRenderingContext2D.prototype, 'fillText').and.callFake(
      function (this: CanvasRenderingContext2D, text: string) {
        texts.push(text);
      }
    );

    return texts;
  }

  it('bleibt ohne Spiele leer', () => {
    create([]);

    expect(fixture.nativeElement.classList).toContain('hidden');
    expect(component.total).toBe(0);
    http.expectNone((req) => req.url.indexOf('leagues/42') >= 0);
  });

  it('zeigt den Knopf, sobald der Spieltag Spiele hat', () => {
    create([game()]);

    expect(fixture.nativeElement.classList).not.toContain('hidden');
    expect(fixture.nativeElement.textContent).toContain('Thumbnails');
    expect(component.total).toBe(1);
  });

  it('legt ein Archiv mit einem Bild je Spiel ab', async () => {
    create([game(), secondGame]);

    await run();

    expect(saved.length).toBe(1);
    expect(saved[0].name).toBe(
      'thumbnails-2-floorball-bundesliga-herren-spieltag-3-2026-01-11.zip'
    );
    expect(saved[0].blob.type).toBe('application/zip');

    const entries = await readZip(saved[0].blob);

    // Anzahl UND Reihenfolge: Die laufende Nummer steht vorn, damit die
    // Sortierung im Ordner der Reihenfolge des Spieltags folgt -- danach werden
    // die Streams angelegt.
    expect(entries.map((entry) => entry.name)).toEqual([
      'spieltag-3-2026-01-11/01-18-00-uhc-sparkasse-weissenfels-mfbc-grimma.png',
      'spieltag-3-2026-01-11/02-20-15-mfbc-leipzig-red-devils-wernigerode.png',
    ]);

    // Ein Archiv mit zwei leeren Dateien bestünde jede Namensprüfung.
    for (const entry of entries) {
      expect(isPng(entry.data)).toBeTrue();
      expect(entry.data.length).toBeGreaterThan(1000);
    }

    expect(component.done).toBe(2);
    expect(messages).toEqual([
      { level: 'success', text: '2 Thumbnails als ZIP gespeichert.' },
    ]);
  });

  // Zwei gleichzeitige Durchgänge zeichneten dieselben Bilder doppelt und
  // legten zwei Archive ab.
  it('lässt keinen zweiten Durchgang zu, solange einer läuft', async () => {
    create([game()]);

    const running = component.download();
    await component.download();

    http.expectOne((req) => req.url.indexOf('leagues/42') >= 0).flush(league);
    await running;

    expect(saved.length).toBe(1);
  });

  // Im Bild steht die Paarung, nicht der Endstand: Der Stapel wird VOR der
  // Übertragung gebraucht. Dazu Datum, Anwurf und Halle des Spieltags.
  it('zeichnet das Livestream-Bild mit Datum, Anwurf und Halle', async () => {
    const texts = captureText();
    create([game()]);

    await run();

    expect(texts).toContain('LIVESTREAM');
    expect(texts).toContain('So. 11.01.2026 · 18:00 Uhr');
    expect(texts).toContain('Stadtbadhalle');
    expect(texts).toContain('2. FLOORBALL-BUNDESLIGA HERREN');
  });

  // Ein einzelnes Spiel darf den Stapel nicht abbrechen -- und was fehlt, muss
  // dastehen: Im Stapel sieht niemand sechs Bilder durch.
  it('liefert die übrigen Bilder, wenn ein Spiel scheitert', async () => {
    breakRender(2);
    create([game(), secondGame]);

    await run();

    const entries = await readZip(saved[0].blob);
    expect(entries.length).toBe(1);
    expect(entries[0].name).toContain('01-18-00-');

    expect(messages.length).toBe(1);
    expect(messages[0].level).toBe('warning');
    expect(messages[0].text).toContain('1 von 2 Thumbnails');
    expect(messages[0].text).toContain(
      'Nicht erzeugt: MFBC Leipzig – Red Devils Wernigerode.'
    );
    // Der Fortschritt zählt Versuche, nicht Bilder -- sonst stünde er bei einem
    // kaputten Bild still.
    expect(component.done).toBe(2);
  });

  // Ohne ein einziges Bild gibt es kein Archiv. Die Ursache ist zu diesem
  // Zeitpunkt längst erfasst und gehört deshalb in die Fehlermeldung.
  it('meldet einen Durchgang ohne jedes Bild als Fehler, mit Ursache', async () => {
    breakRender(1, 2);
    create([game(), secondGame]);

    await run();

    expect(saved.length).toBe(0);
    expect(messages.length).toBe(1);
    expect(messages[0].level).toBe('error');
    expect(messages[0].text).toContain('kein einziges Thumbnail');
    expect(messages[0].text).toContain(
      'Nicht erzeugt: UHC Sparkasse Weißenfels'
    );
    expect(messages[0].text).toContain('MFBC Leipzig – Red Devils Wernigerode');
  });

  // Alle Bilder fertig, und dann scheitert das Ablegen: Ohne Meldung sucht man
  // die Datei im Download-Ordner vergeblich.
  it('meldet einen Fehlschlag beim Verpacken oder Ablegen', async () => {
    create([game()]);
    clickThrows = true;

    await run();

    expect(saved.length).toBe(0);
    expect(messages.length).toBe(1);
    expect(messages[0].level).toBe('error');
    expect(messages[0].text).toContain('nicht als Archiv speichern');
    // Der Grund wird durchgereicht, nicht verworfen.
    expect(messages[0].text).toContain('Download blockiert.');
  });

  // Ohne Liga fehlen Liganame, Ligazeichen und Farbwelt. Die Bilder entstehen
  // trotzdem, aber der Unterschied muss als WARNUNG ankommen -- nicht als
  // grüner Erfolg mit dem Problemsatz mitten darin.
  it('warnt, wenn die Ligadaten fehlen', async () => {
    create([game()]);

    await run(null);

    expect(saved.length).toBe(1);
    expect(saved[0].name).toBe('thumbnails-spieltag-3-2026-01-11.zip');
    expect(messages.length).toBe(1);
    expect(messages[0].level).toBe('warning');
    expect(messages[0].text).toContain('Ligadaten');
  });

  // Ein Fehlschlag des Ligaabrufs darf nicht behalten werden: Sonst liefert ein
  // zweiter Klick nach einem kurzen Netzproblem stillschweigend wieder
  // neutrale Bilder.
  it('fragt die Liga nach einem Fehlschlag erneut', async () => {
    create([game()]);

    await run(null);
    await run();

    expect(messages.map((message) => message.level)).toEqual([
      'warning',
      'success',
    ]);
  });

  // Fehlt ein hinterlegtes Wappen, steht im Bild das Kürzel. Welche Paarung es
  // betrifft, muss in der Meldung stehen -- sonst prüft man sechs Dateien, um
  // die eine zu finden.
  it('benennt die Paarung, deren Wappen fehlt', async () => {
    create([game({ home_team_logo: '/api/storage/gibt-es-nicht.png' })]);

    await run();

    expect(saved.length).toBe(1);
    expect(messages[0].level).toBe('warning');
    expect(messages[0].text).toContain(
      'Ein Vereinswappen fehlt bei: UHC Sparkasse Weißenfels – MFBC Grimma'
    );
    expect(messages[0].text).toContain('Kürzel');
  });

  // In einer K.-o.-Runde steht die Mannschaft vor der Auslosung nicht fest, der
  // Stream wird aber vorher eingerichtet.
  it('nimmt Spiele ohne feststehende Mannschaften mit', async () => {
    create([game({ home_team_name: '', guest_team_name: '' })]);

    await run();

    const entries = await readZip(saved[0].blob);
    expect(entries[0].name).toBe('spieltag-3-2026-01-11/01-18-00-n-n-n-n.png');
  });

  it('benennt ein Spiel ohne Anwurfzeit als solches', async () => {
    create([game({ start_time: '' })]);

    await run();

    const entries = await readZip(saved[0].blob);
    expect(entries[0].name).toContain('/01-ohne-zeit-');
  });

  // Der Spielplan baut seine Spieltage bei jedem Neuladen neu und zerstört die
  // Komponente dabei. Ohne Riegel landete danach ein Archiv im Download-Ordner,
  // das niemand mehr angefordert hat.
  it('bricht ab, wenn die Komponente zerstört wird', async () => {
    create([game(), secondGame]);

    const running = component.download();
    http.expectOne((req) => req.url.indexOf('leagues/42') >= 0).flush(league);
    fixture.destroy();
    await running;

    expect(saved.length).toBe(0);
    expect(messages.length).toBe(0);
  });
});
