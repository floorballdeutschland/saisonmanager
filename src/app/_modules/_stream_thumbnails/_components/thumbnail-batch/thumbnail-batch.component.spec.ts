import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { NotificationService } from '@floorball/core';
import { Game } from '@floorball/types';

import { ThumbnailBatchComponent } from './thumbnail-batch.component';

describe('ThumbnailBatchComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<ThumbnailBatchComponent>;
  let component: ThumbnailBatchComponent;
  let messages: { level: string; text: string }[];
  /** Was der Browser zum Ablegen bekam: Name der Datei und ihr Inhalt. */
  let saved: { name: string; blob: Blob }[];

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

    // Der Download läuft über einen Anker mit `download`-Attribut. Abgefangen
    // wird der Klick, nicht die Erzeugung: So steht hier genau das, was im
    // Download-Ordner gelandet wäre.
    saved = [];
    let pending: Blob | null = null;
    spyOn(URL, 'createObjectURL').and.callFake((blob: Blob | MediaSource) => {
      pending = blob as Blob;
      return 'blob:test';
    });
    spyOn(URL, 'revokeObjectURL');
    spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (
      this: HTMLAnchorElement
    ) {
      saved.push({ name: this.download, blob: pending as Blob });
    });

    fixture = TestBed.createComponent(ThumbnailBatchComponent);
    component = fixture.componentInstance;
    component.leagueId = 42;
    component.gameDayNumber = 3;
    component.date = '2026-10-12';
    component.arenaName = 'Stadtbadhalle';
  });

  function game(overrides: Partial<Game> = {}): Game {
    return {
      id: 1,
      game_number: '4711',
      start_time: '18:00',
      home_team_name: 'UHC Sparkasse Weißenfels',
      guest_team_name: 'MFBC Grimma',
      ...overrides,
    } as unknown as Game;
  }

  const league = {
    id: 42,
    name: '2. Floorball-Bundesliga Herren',
    league_class_id: '2fbl',
    league_type: 'league',
    female: false,
  };

  /** Der Durchgang samt Ligaabruf; `null` beantwortet ihn mit einem Fehler. */
  async function run(response: object | null = league): Promise<void> {
    const running = component.download();

    const request = http.expectOne((req) => req.url.indexOf('leagues/42') >= 0);
    if (response) {
      request.flush(response);
    } else {
      request.error(new ProgressEvent('error'));
    }

    await running;
  }

  async function entryNames(blob: Blob): Promise<string[]> {
    // Die Namen stehen im Klartext im Archiv (je einmal im lokalen Kopfsatz und
    // einmal im Verzeichnis). Für den Prüfsatz genügt die Suche darin; der
    // Aufbau selbst ist in `zip-store.spec.ts` festgehalten.
    const text = new TextDecoder('utf-8').decode(await blob.arrayBuffer());

    return [...text.matchAll(/[0-9a-z-]+\.png/g)].map((match) => match[0]);
  }

  it('bleibt ohne Spiele leer', () => {
    component.games = [];
    fixture.detectChanges();

    expect(fixture.nativeElement.classList).toContain('hidden');
    expect(component.total).toBe(0);
  });

  it('legt ein Archiv mit einem Bild je Spiel ab', async () => {
    component.games = [
      game(),
      game({
        id: 2,
        start_time: '20:15',
        home_team_name: 'MFBC Leipzig',
        guest_team_name: 'Red Devils Wernigerode',
      }),
    ];
    fixture.detectChanges();

    await run();

    expect(saved.length).toBe(1);
    expect(saved[0].name).toBe(
      'thumbnails-2-floorball-bundesliga-herren-spieltag-3-2026-10-12.zip'
    );
    expect(saved[0].blob.type).toBe('application/zip');

    const names = await entryNames(saved[0].blob);
    // Die laufende Nummer steht vorn, damit die Sortierung im Ordner der
    // Reihenfolge des Spieltags folgt -- danach werden die Streams angelegt.
    expect(names).toContain(
      '01-18-00-uhc-sparkasse-weissenfels-mfbc-grimma.png'
    );
    expect(names[0]).toMatch(/^01-18-00-/);
    expect(names).toContain('02-20-15-mfbc-leipzig-red-devils-wernigerode.png');
    expect(messages.map((m) => m.text).join(' ')).toContain(
      '2 Thumbnails als ZIP gespeichert'
    );
  });

  // Zwei gleichzeitige Durchgänge zeichneten dieselben Bilder doppelt und
  // legten zwei Archive ab.
  it('lässt keinen zweiten Durchgang zu, solange einer läuft', async () => {
    component.games = [game()];
    fixture.detectChanges();

    const running = component.download();
    await component.download();

    http.expectOne((req) => req.url.indexOf('leagues/42') >= 0).flush(league);
    await running;

    expect(saved.length).toBe(1);
  });

  // Ohne Liga fehlen Ligazeichen und Farbwelt. Die Bilder entstehen trotzdem,
  // aber der Unterschied muss in der Meldung stehen: Im Stapel sieht sie
  // niemand vorher an.
  it('sagt es, wenn die Ligadaten fehlen', async () => {
    component.games = [game()];
    fixture.detectChanges();

    await run(null);

    expect(saved.length).toBe(1);
    expect(saved[0].name).toBe('thumbnails-spieltag-3-2026-10-12.zip');
    expect(messages.map((m) => m.text).join(' ')).toContain('Ligadaten');
    expect(messages.every((m) => m.level !== 'error')).toBeTrue();
  });

  // In einer K.-o.-Runde steht die Mannschaft vor der Auslosung nicht fest, der
  // Stream wird aber vorher eingerichtet.
  it('nimmt Spiele ohne feststehende Mannschaften mit', async () => {
    component.games = [
      game({ home_team_name: '', guest_team_name: '' } as Partial<Game>),
    ];
    fixture.detectChanges();

    await run();

    const names = await entryNames(saved[0].blob);
    expect(names).toContain('01-18-00-n-n-n-n.png');
  });

  it('benennt ein Spiel ohne Anwurfzeit als solches', async () => {
    component.games = [game({ start_time: '' } as Partial<Game>)];
    fixture.detectChanges();

    await run();

    const names = await entryNames(saved[0].blob);
    expect(names[0]).toMatch(/^01-ohne-zeit-/);
  });
});
