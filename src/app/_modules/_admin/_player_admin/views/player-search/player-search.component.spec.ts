import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { FormsModule } from '@angular/forms';
import { Observable, of, throwError } from 'rxjs';

import { PlayerSearchComponent } from './player-search.component';
import { PlayerService, getTranslocoTestingModule } from '@floorball/core';
import { UikitPlayerModule } from '@floorball/uikit/player';
import { PlayerSearchResult } from '@floorball/models';

describe('PlayerSearchComponent', () => {
  // Die Komponente steht hier ohne ihr Modul und damit ohne dessen
  // TRANSLOCO_SCOPE. Die Keys muessen deshalb global unter dem Alias stehen,
  // den das Modul vergibt ("playerAdmin"), sonst rendert die Vorlage die rohen
  // Keys und die Tabelle bleibt wirkungslos.
  const translations = {
    de: {
      playerAdmin: {
        common: { title: 'Spieler' },
        search: {
          globalSearch: 'Globale Spielersuche',
          search: 'Suche',
          searchPlaceholder: 'Vor- oder Nachname',
          results: 'Ergebnisse',
          searching: 'wird gesucht...',
          noResults: 'Keine Spieler gefunden.',
          searchFailed: 'Die Suche ist fehlgeschlagen.',
          minChars: 'Mindestens 2 Zeichen eingeben.',
          deactivatedBadge: 'deaktiviert',
          noAccessBadge: 'kein Zugriff',
          noAccessHint: 'Zustaendig ist {{association}}.',
          noAccessHintUnknown: 'Kein Spielbetrieb zustaendig.',
          playerStatsLink: 'Spielerdaten-Rangliste',
        },
      },
    },
  };

  function treffer(overrides: Partial<PlayerSearchResult> = {}) {
    return {
      id: 1,
      last_name: 'Blok',
      first_name: 'Chiel',
      birthdate: '2005-11-16',
      gender: 'm',
      club_id: 202,
      ...overrides,
    } as PlayerSearchResult;
  }

  async function configure(
    globalSearch: () => Observable<PlayerSearchResult[]>
  ) {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        FormsModule,
        UikitPlayerModule,
        getTranslocoTestingModule(translations),
      ],
      declarations: [PlayerSearchComponent],
      providers: [
        {
          provide: PlayerService,
          useValue: { globalSearch },
        },
      ],
    }).compileComponents();
  }

  async function setup(
    results: PlayerSearchResult[],
    zustand: Partial<PlayerSearchComponent> = {}
  ) {
    await configure(() => of(results));

    const fixture = TestBed.createComponent(PlayerSearchComponent);
    fixture.componentInstance.results = results;
    fixture.componentInstance.searched = true;
    Object.assign(fixture.componentInstance, zustand);
    fixture.detectChanges();
    return fixture;
  }

  it('should create', async () => {
    const fixture = await setup([]);
    expect(fixture.componentInstance).toBeTruthy();
  });

  // Der zweite Weg in dieselbe Frage: Wer hier einen Namen sucht, findet
  // ueber die Rangliste die Personen mit den meisten Einsaetzen. Ohne :clubId
  // laeuft die Route in den Verbandsmodus der API (fe#300).
  it('verweist auf die Spielerdaten-Rangliste des Verbands', async () => {
    const fixture = await setup([]);

    const link = fixture.nativeElement.querySelector(
      '[data-testid="player-stats-link"]'
    );
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/verwaltung/spieler/spielerdaten');
  });

  // Deaktivierte Profile sind seit api#472 Teil des Ergebnisses. Ohne einen
  // Hinweis am Treffer waere nicht zu erkennen, warum die Person in der
  // Vereinsliste ihres Vereins fehlt.
  it('kennzeichnet einen deaktivierten Treffer', async () => {
    const fixture = await setup([
      treffer({ deactivated_at: '2026-07-25T09:46:55Z' }),
    ]);

    expect(fixture.nativeElement.textContent).toContain('Blok, Chiel');
    expect(fixture.nativeElement.textContent).toContain('deaktiviert');
  });

  it('kennzeichnet einen aktiven Treffer nicht', async () => {
    const fixture = await setup([treffer()]);

    expect(fixture.nativeElement.textContent).toContain('Blok, Chiel');
    expect(fixture.nativeElement.textContent).not.toContain('deaktiviert');
  });

  // Der Regressionsfall: Die Suche geht ueber den gesamten Bestand, das Profil
  // dahinter ist auf den Heimat-Spielbetrieb begrenzt. Ein Link auf einen
  // Treffer aus einem anderen Landesverband endete mit 403 und warf ueber den
  // ErrorInterceptor auf die Startseite, samt Suchbegriff und Trefferliste.
  it('verlinkt einen Treffer ohne Zugriff nicht und nennt den zustaendigen Verband', async () => {
    const fixture = await setup([
      treffer({ manageable: false, responsible: 'SBK Ost' }),
    ]);

    expect(fixture.nativeElement.textContent).toContain('Blok, Chiel');
    expect(fixture.nativeElement.textContent).toContain('kein Zugriff');
    expect(fixture.nativeElement.textContent).toContain(
      'Zustaendig ist SBK Ost.'
    );
    expect(fixture.nativeElement.querySelector('li a')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="locked-result"]')
    ).toBeTruthy();
  });

  // Ohne gueltige Heimat-Zugehoerigkeit ist niemand zustaendig (api#389). Der
  // Hinweis darf dann keinen Verband erfinden.
  it('nennt ohne zustaendigen Verband den allgemeinen Hinweis', async () => {
    const fixture = await setup([
      treffer({ manageable: false, responsible: null }),
    ]);

    expect(fixture.nativeElement.textContent).toContain(
      'Kein Spielbetrieb zustaendig.'
    );
  });

  it('verlinkt einen Treffer mit Zugriff', async () => {
    const fixture = await setup([treffer({ manageable: true })]);

    const link = fixture.nativeElement.querySelector('li a');
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe(
      '/verwaltung/vereine/202/spieler/1/bearbeiten'
    );
    expect(fixture.nativeElement.textContent).not.toContain('kein Zugriff');
  });

  // Eine Antwort ohne das Feld (aeltere API) darf die Trefferliste nicht
  // sperren: Der Link ist der Normalfall, die Sperre die Ausnahme.
  it('verlinkt einen Treffer ohne die Angabe wie bisher', async () => {
    const fixture = await setup([treffer()]);

    expect(fixture.nativeElement.querySelector('li a')).toBeTruthy();
    expect(fixture.nativeElement.textContent).not.toContain('kein Zugriff');
  });

  // Der eigentliche Fall der Kennzeichnung: In einer Liste stehen eigene und
  // fremde Treffer nebeneinander. Ein Urteil, das versehentlich fuer die ganze
  // Liste faellt statt je Zeile, faellt nur hier auf.
  it('entscheidet je Zeile, nicht fuer die ganze Liste', async () => {
    const fixture = await setup([
      treffer({ id: 1, last_name: 'Eigen', manageable: true }),
      treffer({
        id: 2,
        last_name: 'Fremd',
        manageable: false,
        responsible: 'SBK Ost',
      }),
    ]);

    const zeilen = fixture.nativeElement.querySelectorAll('li');
    expect(zeilen.length).toBe(2);
    expect(zeilen[0].querySelector('a')).toBeTruthy();
    expect(zeilen[0].textContent).not.toContain('kein Zugriff');
    expect(zeilen[1].querySelector('a')).toBeNull();
    expect(zeilen[1].textContent).toContain('kein Zugriff');
  });

  describe('gescheiterte Suche', () => {
    // „Keine Spieler gefunden" ist eine Aussage ueber den Bestand. Bei einem
    // gescheiterten Abruf ist sie falsch, und zwar in der gefaehrlichsten
    // Richtung: Diese Suche klaert, ob es eine Person schon gibt, und die
    // falsche Auskunft fuehrt geradewegs zu einer Dublette.
    it('meldet den Fehlschlag statt „keine Treffer"', async () => {
      const fixture = await setup([], { searchFailed: true });

      expect(fixture.nativeElement.textContent).toContain(
        'Die Suche ist fehlgeschlagen.'
      );
      expect(fixture.nativeElement.textContent).not.toContain(
        'Keine Spieler gefunden.'
      );
    });

    it('meldet ohne Fehlschlag weiterhin „keine Treffer"', async () => {
      const fixture = await setup([]);

      expect(fixture.nativeElement.textContent).toContain(
        'Keine Spieler gefunden.'
      );
      expect(fixture.nativeElement.textContent).not.toContain(
        'Die Suche ist fehlgeschlagen.'
      );
    });

    // Die Debounce-Zeit der Suche (300 ms) laesst sich nur mit einer
    // kontrollierten Uhr ueberspringen: fakeAsync/tick und nicht
    // jasmine.clock(), denn der Scheduler von RxJS laeuft ueber die von zone.js
    // gepatchten Timer, die jasmine.clock() nicht erreicht.
    //
    // Die beiden Faelle pruefen den Zustand der Komponente, nicht das DOM: Sie
    // laufen ueber echte Emissionen des langlebigen Subjects, und dazwischen zu
    // rendern brauchen sie nicht.
    describe('ueber den Suchpfad', () => {
      let scheitern: boolean;

      beforeEach(async () => {
        scheitern = true;
        await configure(() =>
          scheitern ? throwError(() => new Error('kaputt')) : of([treffer()])
        );
      });

      it('merkt sich einen gescheiterten Abruf', fakeAsync(() => {
        const component = TestBed.createComponent(
          PlayerSearchComponent
        ).componentInstance;

        component.onQueryChange('Blok');
        tick(400);

        expect(component.searchFailed).toBe(true);
        expect(component.results).toEqual([]);
        expect(component.loading).toBe(false);
      }));

      // Der Fehler darf die Kette nicht beenden: `_query$` ist ein langlebiges
      // Subject, ein bis zum aeusseren Subscriber durchgereichter Fehler haette
      // das Suchfeld nach einem einzigen Fehlschlag dauerhaft tot
      // zurueckgelassen -- ohne Ladeanzeige, ohne Meldung, bis zum Neuladen.
      it('sucht nach einem Fehlschlag weiter', fakeAsync(() => {
        const component = TestBed.createComponent(
          PlayerSearchComponent
        ).componentInstance;

        component.onQueryChange('Blok');
        tick(400);
        expect(component.searchFailed).toBe(true);

        scheitern = false;
        component.onQueryChange('Blok Chiel');
        tick(400);

        expect(component.searchFailed).toBe(false);
        expect(component.results.map((r) => r.id)).toEqual([1]);
      }));
    });
  });
});
