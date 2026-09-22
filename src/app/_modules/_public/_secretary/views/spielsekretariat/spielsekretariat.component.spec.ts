import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { Location } from '@angular/common';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from 'src/environments/environment';

import { SpielSekretariatComponent } from './spielsekretariat.component';

describe('SpielSekretariatComponent', () => {
  let component: SpielSekretariatComponent;
  let fixture: ComponentFixture<SpielSekretariatComponent>;
  let httpMock: HttpTestingController;
  // Beweglich, damit die Tests zur Code-Eingabe ohne Token auskommen: Die
  // Komponente liest den Parameter erst in ngOnInit, und das ruft hier jeder
  // Test selbst auf.
  let queryParams: Record<string, string>;
  // Die Adresse, wie Location sie sieht, und was die Komponente daraus macht.
  // Der Kurzcode muss aus der Adresszeile verschwinden, bevor er eingeloest
  // wird -- sonst schickt jedes Neuladen ihn erneut in die Drossel.
  let currentPath: string;
  let replacedPaths: string[];

  const day = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    date: '2026-01-01',
    league: 'Liga',
    league_id: null,
    arena: null,
    game_operation_slug: null,
    ...overrides,
  });

  const setData = (
    days: [ReturnType<typeof day>, ...ReturnType<typeof day>[]]
  ) => {
    component.data = {
      game_days: days,
      games: [],
      license_lists: {},
      expires_at: '2026-01-02T00:00:00Z',
    } as (typeof component)['data'];
  };

  beforeEach(async () => {
    queryParams = { token: 'tok en' };
    currentPath = '/spielsekretariat';
    replacedPaths = [];
    sessionStorage.removeItem('secretary_token');

    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, FormsModule],
      declarations: [SpielSekretariatComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              get queryParamMap() {
                return convertToParamMap(queryParams);
              },
            },
          },
        },
        {
          provide: Location,
          useValue: {
            path: () => currentPath,
            replaceState: (path: string) => replacedPaths.push(path),
          },
        },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SpielSekretariatComponent);
    component = fixture.componentInstance;
    component.token = 'tok en';
  });

  afterEach(() => {
    sessionStorage.removeItem('secretary_token');
  });

  describe('matchReportUrl', () => {
    // Die öffentliche Spielseite liegt unter /:association/:leagueId/spiel/:matchId.
    // Ein Teilpfad ist gefährlich statt harmlos: :association/:leagueId schluckt
    // zwei beliebige Segmente, sodass eine falsche Adresse als leere Seite endet.
    it('should build the public match page url and encode the token', () => {
      setData([day({ league_id: 42, game_operation_slug: 'fd' })]);

      expect(component.matchReportUrl({ id: 7, game_day_id: 1 })).toBe(
        '/fd/42/spiel/7?secretary_token=tok%20en'
      );
    });

    it('should not link without a league id', () => {
      setData([day({ game_operation_slug: 'fd' })]);

      expect(component.matchReportUrl({ id: 7, game_day_id: 1 })).toBeNull();
    });

    it('should not link without an association slug', () => {
      setData([day({ league_id: 42 })]);

      expect(component.matchReportUrl({ id: 7, game_day_id: 1 })).toBeNull();
    });

    it('should not link before the game day is loaded', () => {
      component.data = undefined;

      expect(component.matchReportUrl({ id: 7, game_day_id: 1 })).toBeNull();
    });
  });

  // Ein Link deckt alle Spieltage ab, die am selben Tag in derselben Halle
  // laufen. Ein Spiel der zweiten Liga darf dann nicht unter der leagueId der
  // ersten verlinkt werden.
  describe('mit mehreren Spieltagen im Link', () => {
    beforeEach(() => {
      setData([
        day({
          id: 1,
          league: 'U15',
          league_id: 10,
          game_operation_slug: 'fd',
          arena: 'Sporthalle Nord',
        }),
        day({
          id: 2,
          league: 'U17',
          league_id: 20,
          game_operation_slug: 'fd',
          arena: 'Sporthalle Nord',
        }),
      ]);
    });

    it('verlinkt jedes Spiel unter der Liga seines eigenen Spieltags', () => {
      expect(component.matchReportUrl({ id: 7, game_day_id: 2 })).toBe(
        '/fd/20/spiel/7?secretary_token=tok%20en'
      );
    });

    it('verlinkt nicht, wenn der Spieltag des Spiels unbekannt ist', () => {
      expect(component.matchReportUrl({ id: 7, game_day_id: 99 })).toBeNull();
    });

    it('nennt alle Ligen im Kopf und schaltet die Liga je Spiel frei', () => {
      expect(component.headerTitle()).toBe('U15 · U17');
      expect(component.multipleLeagues).toBe(true);
      expect(component.arena()).toBe('Sporthalle Nord');
      expect(component.date()).toBe('2026-01-01');
    });

    it('zeigt die Liga an jedem Spiel, sobald der Link mehrere umfasst', () => {
      component.data = {
        ...component.data!,
        games: [
          {
            id: 7,
            game_day_id: 2,
            league: 'U17',
            home_team: 'A',
            guest_team: 'B',
          },
        ],
      } as (typeof component)['data'];
      // ngOnInit stößt beim ersten detectChanges den Abruf an, der im Test nie
      // antwortet – sonst zeigt die Seite dauerhaft den Ladezustand.
      component.loading = false;

      fixture.detectChanges();

      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('A');
      expect(text).toContain('U17');
    });
  });

  describe('Lizenzlisten nach Liga', () => {
    const build = (
      days: [ReturnType<typeof day>, ...ReturnType<typeof day>[]],
      licenseLists: Record<string, unknown>
    ) =>
      component['_buildLicenseGroups']({
        game_days: days,
        games: [],
        license_lists: licenseLists,
        expires_at: '2026-01-02T00:00:00Z',
      } as unknown as NonNullable<(typeof component)['data']>);

    it('gruppiert nach Liga in der Reihenfolge der Spieltage', () => {
      // Die Schlüssel stehen absichtlich in der „falschen" Reihenfolge: Auf die
      // Reihenfolge in einem Objekt mit zahlenartigen Schlüsseln ist kein
      // Verlass, maßgeblich sind die Spieltage.
      const groups = build(
        [
          day({ id: 1, league: 'Herren', league_id: 10 }),
          day({ id: 2, league: 'U13', league_id: 20 }),
        ],
        {
          '900': { team_name: 'U13 Gast', league_id: 20, players: [] },
          '100': { team_name: 'Herren Heim', league_id: 10, players: [] },
          '200': { team_name: 'Herren Gast', league_id: 10, players: [] },
        }
      );

      expect(groups.map((g) => g.leagueName)).toEqual(['Herren', 'U13']);
      expect(groups[0].entries.map((e) => e.team_name)).toEqual([
        'Herren Gast',
        'Herren Heim',
      ]);
      expect(groups[1].entries.map((e) => e.team_name)).toEqual(['U13 Gast']);
    });

    it('zeigt eine Mannschaft unter jeder Liga, in der sie antritt', () => {
      // Vormittags Ligaspiel, nachmittags Pokal in derselben Halle. Mit nur
      // einer Liga fehlte die Lizenzliste unter der zweiten Ueberschrift
      // vollstaendig, und das Sekretariat des zweiten Spiels suchte sie dort
      // vergeblich.
      const groups = build(
        [
          day({ id: 1, league: 'Herren', league_id: 10 }),
          day({ id: 2, league: 'Pokal', league_id: 30 }),
        ],
        {
          '100': {
            team_name: 'Doppel Heim',
            league_id: 10,
            leagues: [
              { id: 10, name: 'Herren' },
              { id: 30, name: 'Pokal' },
            ],
            players: [],
          },
          '200': { team_name: 'Nur Pokal', league_id: 30, players: [] },
        }
      );

      expect(groups.map((g) => g.leagueName)).toEqual(['Herren', 'Pokal']);
      expect(groups[0].entries.map((e) => e.team_name)).toEqual([
        'Doppel Heim',
      ]);
      expect(groups[1].entries.map((e) => e.team_name)).toEqual([
        'Doppel Heim',
        'Nur Pokal',
      ]);
    });

    it('faellt ohne leagues auf league_id zurueck', () => {
      // Aeltere API: kennt `leagues` noch nicht, die Gruppierung muss trotzdem
      // stehen.
      const groups = build([day({ id: 1, league: 'Herren', league_id: 10 })], {
        '100': { team_name: 'Heim', league_id: 10, players: [] },
      });

      expect(groups.length).toBe(1);
      expect(groups[0].entries.map((e) => e.team_name)).toEqual(['Heim']);
    });

    it('laesst Ligen ohne Lizenzliste weg', () => {
      const groups = build(
        [
          day({ id: 1, league: 'Herren', league_id: 10 }),
          day({ id: 2, league: 'U13', league_id: 20 }),
        ],
        { '100': { team_name: 'Herren Heim', league_id: 10, players: [] } }
      );

      expect(groups.length).toBe(1);
      expect(groups[0].leagueName).toBe('Herren');
    });

    it('bleibt bei einer flachen Liste, wenn die API keine Liga liefert', () => {
      const groups = build([day({ id: 1, league: 'Herren', league_id: 10 })], {
        '100': { team_name: 'Heim', players: [] },
        '200': { team_name: 'Gast', players: [] },
      });

      expect(groups.length).toBe(1);
      expect(groups[0].leagueName).toBeNull();
      expect(groups[0].entries.length).toBe(2);
    });

    it('zeigt die Ueberschrift erst ab der zweiten Liga', () => {
      component.licenseGroups = build(
        [day({ id: 1, league: 'Herren', league_id: 10 })],
        { '100': { team_name: 'Heim', league_id: 10, players: [] } }
      );
      expect(component.multipleLicenseLeagues).toBe(false);

      component.licenseGroups = build(
        [
          day({ id: 1, league: 'Herren', league_id: 10 }),
          day({ id: 2, league: 'U13', league_id: 20 }),
        ],
        {
          '100': { team_name: 'Heim', league_id: 10, players: [] },
          '900': { team_name: 'U13', league_id: 20, players: [] },
        }
      );
      expect(component.multipleLicenseLeagues).toBe(true);
    });
  });

  // Am Spieltisch wird an dieser Spalte die Spielberechtigung abgelesen. Eine
  // Sperre auf einen Wettbewerb oder eine Liga steht nicht in der
  // Lizenzhistorie (api#605), der Gesperrte stand hier also auf „erteilt".
  describe('Sperre je Liga-Ueberschrift', () => {
    // So schickt es die API: `license_status` traegt die Sperre schon, sobald
    // sie IRGENDEINE Liga des Links erfasst (sichere Vorgabe fuer Leser, die
    // nicht je Ueberschrift unterscheiden), `base_license_status` ist der
    // Status ohne Sperre.
    const eintrag = (ids?: number[]) =>
      ({
        name: 'Anna Meier',
        license_status: ids?.length ? 'gesperrt' : 'erteilt',
        base_license_status: 'erteilt',
        suspended_league_ids: ids,
        suspension_scope: 'Herren Großfeld, Ligaspielbetrieb',
      }) as unknown as Parameters<(typeof component)['licenseStatus']>[0];

    it('gilt nur unter der Liga, die die Sperre erfasst', () => {
      // Dieselbe Lizenzliste steht unter der Liga- und der Pokal-Ueberschrift:
      // Die Mannschaft spielt vormittags Liga, nachmittags Pokal.
      const p = eintrag([10]);

      expect(component.licenseStatus(p, 10)).toBe('gesperrt');
      expect(component.licenseStatus(p, 30)).toBe('erteilt');
      expect(component.isSuspended(p, 30)).toBe(false);
    });

    it('bleibt bei erteilt, wenn die API keine Sperren nennt', () => {
      expect(component.licenseStatus(eintrag(undefined), 10)).toBe('erteilt');
    });

    // Ohne `base_license_status` (aeltere API) bleibt es beim gelieferten
    // Status. Uebermarkieren ist die Richtung, in die eine Lizenzliste irren
    // darf -- „erteilt" fuer einen Gesperrten ist es nicht.
    it('faellt ohne Basis-Status auf den gelieferten zurueck', () => {
      const alt = {
        name: 'Anna Meier',
        license_status: 'gesperrt',
        suspended_league_ids: [10],
      } as unknown as Parameters<(typeof component)['licenseStatus']>[0];

      expect(component.licenseStatus(alt, 10)).toBe('gesperrt');
      expect(component.licenseStatus(alt, 30)).toBe('gesperrt');
    });

    // Ohne Liga-Zuordnung (aeltere API, flache Liste) ist die Frage nicht
    // beantwortbar; dann lieber der gespeicherte Status als eine geratene
    // Sperre.
    it('entscheidet ohne Liga-Id nicht auf gesperrt', () => {
      expect(component.isSuspended(eintrag([10]), null)).toBe(false);
    });

    it('faerbt die Status aus License::NAMES, gesperrt rot', () => {
      expect(component.statusClass('erteilt')).toContain('text-green-700');
      expect(component.statusClass('beantragt')).toContain('text-yellow-700');
      expect(component.statusClass('gesperrt')).toContain('text-red-700');
      expect(component.statusClass('zurückgezogen')).toContain(
        'text-fb-gray-400'
      );
    });

    it('zeigt gesperrt samt Geltungsbereich nur unter der betroffenen Liga', () => {
      // Der Kopf der Seite haengt an `data`, die Registerkarten an `loading`:
      // Ohne beides rendert das Template nur „Lade Daten…".
      setData([day({ id: 1, league: 'Herren', league_id: 10 })]);
      component.loading = false;
      component.activeTab = 'licenses';
      component.licenseGroups = [
        {
          leagueId: 10,
          leagueName: 'Herren',
          entries: [
            {
              team_name: 'Musterstadt',
              players: [eintrag([10])],
            } as unknown as (typeof component)['licenseGroups'][0]['entries'][0],
          ],
        },
        {
          leagueId: 30,
          leagueName: 'Pokal',
          entries: [
            {
              team_name: 'Musterstadt',
              players: [eintrag([10])],
            } as unknown as (typeof component)['licenseGroups'][0]['entries'][0],
          ],
        },
      ];
      fixture.detectChanges();

      const spalten = Array.from(
        fixture.nativeElement.querySelectorAll('tbody tr td:nth-child(3)')
      ).map((el) => (el as HTMLElement).textContent?.trim() ?? '');

      expect(spalten[0]).toContain('gesperrt');
      expect(spalten[0]).toContain('Herren Großfeld, Ligaspielbetrieb');
      expect(spalten[1]).toBe('erteilt');
    });
  });

  describe('mit einem einzelnen Spieltag', () => {
    it('nennt nur dessen Liga und blendet die Liga je Spiel aus', () => {
      setData([
        day({ league: 'U15', league_id: 10, game_operation_slug: 'fd' }),
      ]);

      expect(component.gameDays().length).toBe(1);
      expect(component.multipleLeagues).toBe(false);
      expect(component.headerTitle()).toBe('U15');
    });
  });

  // Am Spieltisch steht ein Vereinsrechner ohne Benutzerkonto. Der Zugang kommt
  // dort als achtstelliger Code an und wird abgetippt.
  describe('Code-Eingabe', () => {
    const redeemUrl = environment.apiURL + 'public/secretary/redeem';
    const payload = {
      game_day: null,
      game_days: [day({ id: 1 })],
      games: [],
      license_lists: {},
      expires_at: '2026-01-02T00:00:00Z',
    };

    beforeEach(() => {
      queryParams = {};
    });

    it('zeigt die Eingabe, wenn weder Adresse noch Registerkarte einen Token tragen', () => {
      component.ngOnInit();

      expect(component.showCodeForm).toBe(true);
      expect(component.loading).toBe(false);
      httpMock.expectNone(() => true);
    });

    it('tauscht den Code und laedt damit den Spieltag', () => {
      component.ngOnInit();
      component.codeInput = 'k7qf-3mxr';

      component.redeemCode();

      const redeem = httpMock.expectOne(redeemUrl);
      expect(redeem.request.method).toBe('POST');
      // Normalisiert wie serverseitig: Trennstrich weg, Grossschreibung.
      expect(redeem.request.body).toEqual({ code: 'K7QF3MXR' });
      redeem.flush({
        token: 'langer-token',
        expires_at: '2026-01-02T00:00:00Z',
      });

      httpMock
        .expectOne(environment.apiURL + 'public/secretary?token=langer-token')
        .flush(payload);

      expect(component.showCodeForm).toBe(false);
      expect(component.token).toBe('langer-token');
      expect(component.loading).toBe(false);
    });

    // Ohne das Ablegen verloere ein schlichtes Neuladen am Spieltisch den
    // Zugang, und der Code muesste mitten im Spiel erneut abgetippt werden.
    // Abgelegt wird schon nach dem Einloesen, nicht erst nach dem Laden: Der
    // Token ist frisch ausgestellt, und auf dem Weg ueber die Adresse ist er
    // das Einzige, was die Registerkarte noch hat.
    it('legt den frisch eingeloesten Token sofort ab', () => {
      component.ngOnInit();
      component.codeInput = 'K7QF3MXR';

      component.redeemCode();
      httpMock.expectOne(redeemUrl).flush({
        token: 'langer-token',
        expires_at: '2026-01-02T00:00:00Z',
      });

      expect(sessionStorage.getItem('secretary_token')).toBe('langer-token');

      httpMock
        .expectOne(environment.apiURL + 'public/secretary?token=langer-token')
        .flush(payload);

      expect(sessionStorage.getItem('secretary_token')).toBe('langer-token');
    });

    it('nutzt den abgelegten Token derselben Registerkarte', () => {
      sessionStorage.setItem('secretary_token', 'langer-token');

      component.ngOnInit();

      expect(component.showCodeForm).toBe(false);
      httpMock
        .expectOne(environment.apiURL + 'public/secretary?token=langer-token')
        .flush(payload);
      expect(component.loading).toBe(false);
    });

    // Sonst zeigt das Neuladen dauerhaft die Fehlermeldung, und der Weg zurueck
    // zur Eingabe waere nur ueber eine neue Registerkarte zu finden.
    it('verwirft einen abgelaufenen abgelegten Token und bietet die Eingabe an', () => {
      sessionStorage.setItem('secretary_token', 'alt');

      component.ngOnInit();
      httpMock
        .expectOne(environment.apiURL + 'public/secretary?token=alt')
        .flush(
          { message: 'Dieser Link ist ungültig oder abgelaufen.' },
          { status: 410, statusText: 'Gone' }
        );

      expect(component.showCodeForm).toBe(true);
      expect(component.error).toBe('Dieser Link ist ungültig oder abgelaufen.');
      expect(sessionStorage.getItem('secretary_token')).toBeNull();
    });

    it('meldet einen ungueltigen Code am Feld und laesst die Eingabe stehen', () => {
      component.ngOnInit();
      component.codeInput = '2345ABCD';

      component.redeemCode();
      httpMock
        .expectOne(redeemUrl)
        .flush(
          { message: 'Dieser Code ist ungültig oder abgelaufen.' },
          { status: 410, statusText: 'Gone' }
        );

      expect(component.codeError).toBe(
        'Dieser Code ist ungültig oder abgelaufen.'
      );
      expect(component.showCodeForm).toBe(true);
      expect(component.redeeming).toBe(false);
    });

    it('schickt eine leere Eingabe nicht ab', () => {
      component.ngOnInit();
      component.codeInput = '   ';

      component.redeemCode();

      httpMock.expectNone(redeemUrl);
      expect(component.codeError).toBeTruthy();
    });

    // Rack::Attack zaehlt vor dem Router. Ein Vertipper, der erst am Server
    // auffiele, verbrauchte einen der zehn Versuche pro Minute, die sich in der
    // Halle alle Rechner hinter einer Adresse teilen.
    it('schickt einen formfehlerhaften Code gar nicht erst ab', () => {
      component.ngOnInit();

      component.codeInput = 'K7QF3MX';
      component.redeemCode();
      httpMock.expectNone(redeemUrl);

      // U gehoert als einziger Buchstabe nicht zum Alphabet und wird auch auf
      // nichts abgebildet -- anders als O, I und L.
      component.codeInput = 'K7QFUMXR';
      component.redeemCode();
      httpMock.expectNone(redeemUrl);

      component.codeInput = 'K7QF3MXRA';
      component.redeemCode();
      httpMock.expectNone(redeemUrl);
    });

    // Gegenprobe zum Fall darueber: O, I und L sind keine Formfehler, sondern
    // genau das, was beim Abtippen von 0 und 1 entsteht.
    it('laesst O, I und L als 0 und 1 durch', () => {
      component.ngOnInit();
      component.codeInput = 'k7qf-3mxo';

      component.redeemCode();

      expect(httpMock.expectOne(redeemUrl).request.body).toEqual({
        code: 'K7QF3MX0',
      });
    });

    // Der Drossel-Responder antwortet mit `error`, nicht mit `message`. Ohne
    // die Unterscheidung las das Sekretariat „Code ungueltig", liess sich einen
    // neuen geben (der den bisherigen entwertet) und lief in dieselbe Drossel.
    it('meldet eine Drosselung als Wartezeit, nicht als falschen Code', () => {
      component.ngOnInit();
      component.codeInput = 'K7QF3MXR';

      component.redeemCode();
      httpMock
        .expectOne(redeemUrl)
        .flush(
          { error: 'Rate limit überschritten. Bitte später erneut versuchen.' },
          { status: 429, statusText: 'Too Many Requests' }
        );

      expect(component.codeError).toContain('denselben Code');
      expect(component.codeError).not.toContain('ungültig');
    });

    it('meldet einen Serverfehler nicht als falschen Code', () => {
      component.ngOnInit();
      component.codeInput = 'K7QF3MXR';

      component.redeemCode();
      httpMock
        .expectOne(redeemUrl)
        .flush({}, { status: 502, statusText: 'Bad Gateway' });

      expect(component.codeError).toContain('bleibt gültig');
    });
  });

  // Derselbe Kurzcode, nur in der Adresse statt im Feld: QR-Code auf dem
  // Spielplan-Ausdruck, Aushang in der Halle. Ueberall dort, wo ein Link
  // zustellbar ist, der Spieltisch aber keinen bekommt.
  describe('Code in der Adresse', () => {
    const redeemUrl = environment.apiURL + 'public/secretary/redeem';
    const loadUrl = environment.apiURL + 'public/secretary?token=langer-token';
    const payload = {
      game_day: null,
      game_days: [day({ id: 1 })],
      games: [],
      license_lists: {},
      expires_at: '2026-01-02T00:00:00Z',
    };

    it('loest den Code aus der Adresse ein und laedt damit den Spieltag', () => {
      queryParams = { code: 'k7qf-3mxr' };
      currentPath = '/spielsekretariat?code=k7qf-3mxr';

      component.ngOnInit();

      const redeem = httpMock.expectOne(redeemUrl);
      // Normalisiert wie im Feld: Trennstrich weg, Grossschreibung.
      expect(redeem.request.body).toEqual({ code: 'K7QF3MXR' });
      redeem.flush({
        token: 'langer-token',
        expires_at: '2026-01-02T00:00:00Z',
      });

      httpMock.expectOne(loadUrl).flush(payload);

      expect(component.showCodeForm).toBe(false);
      expect(component.token).toBe('langer-token');
      expect(sessionStorage.getItem('secretary_token')).toBe('langer-token');
    });

    // Der wichtigste Teil: Rack::Attack zaehlt das Einloesen je IP, zehn pro
    // Minute und sechzig pro Stunde, und in der Halle haengen alle Rechner
    // hinter derselben Adresse. Bliebe der Code stehen, verbrauchte jedes
    // Neuladen am Spieltisch einen Versuch -- bis das Sekretariat mitten im
    // Spiel ausgesperrt waere. Geprueft wird der Zustand nach ngOnInit, nicht
    // die Reihenfolge innerhalb: Beides laeuft synchron, und fuer das
    // Neuladen zaehlt allein, dass die Adresse danach sauber ist.
    it('traegt den Code nicht mehr in der Adresse, wenn ngOnInit zurueckkommt', () => {
      queryParams = { code: 'K7QF3MXR' };
      currentPath = '/spielsekretariat?code=K7QF3MXR';

      component.ngOnInit();

      expect(replacedPaths).toEqual(['/spielsekretariat']);
      httpMock.expectOne(redeemUrl);
    });

    it('laesst andere Parameter der Adresse stehen', () => {
      queryParams = { code: 'K7QF3MXR', tab: 'licenses' };
      currentPath = '/spielsekretariat?code=K7QF3MXR&tab=licenses';

      component.ngOnInit();

      expect(replacedPaths).toEqual(['/spielsekretariat?tab=licenses']);
      httpMock.expectOne(redeemUrl);
    });

    // Wer den QR-Code des heutigen Spieltags scannt, meint diesen -- nicht den
    // von gestern, der in derselben Registerkarte noch abgelegt ist.
    it('schlaegt den abgelegten Token derselben Registerkarte', () => {
      sessionStorage.setItem('secretary_token', 'alter-token');
      queryParams = { code: 'K7QF3MXR' };
      currentPath = '/spielsekretariat?code=K7QF3MXR';

      component.ngOnInit();

      httpMock.expectNone(
        environment.apiURL + 'public/secretary?token=alter-token'
      );
      httpMock.expectOne(redeemUrl).flush({
        token: 'langer-token',
        expires_at: '2026-01-02T00:00:00Z',
      });
      httpMock.expectOne(loadUrl).flush(payload);

      expect(component.token).toBe('langer-token');
    });

    // Der fertige Token ist das staerkere Recht und kostet keinen
    // Drosselversuch. Der Code wird trotzdem aus der Adresse geraeumt: Er
    // bleibt ein Zugangsgeheimnis, auch wenn ihn hier niemand braucht.
    it('nimmt den Token, wenn beides in der Adresse steht, und raeumt den Code trotzdem', () => {
      queryParams = { token: 'langer-token', code: 'K7QF3MXR' };
      currentPath = '/spielsekretariat?token=langer-token&code=K7QF3MXR';

      component.ngOnInit();

      expect(replacedPaths).toEqual(['/spielsekretariat?token=langer-token']);
      httpMock.expectNone(redeemUrl);
      httpMock.expectOne(loadUrl).flush(payload);
      expect(component.token).toBe('langer-token');
    });

    // Ein verstuemmelter QR-Code darf keinen der zehn Versuche verbrauchen.
    it('schickt einen formfehlerhaften Code aus der Adresse gar nicht erst ab', () => {
      queryParams = { code: 'K7QF3MX' };
      currentPath = '/spielsekretariat?code=K7QF3MX';

      component.ngOnInit();

      httpMock.expectNone(redeemUrl);
      expect(component.showCodeForm).toBe(true);
      expect(component.loading).toBe(false);
      expect(component.codeError).toBeTruthy();
      // Der unvollstaendige Code bleibt im Feld stehen, damit sichtbar ist,
      // was angekommen ist, und die fehlende Stelle nachgetragen werden kann,
      // statt alles neu zu tippen. Ein zweiter Druck auf „Weiter" allein
      // ergaebe denselben Formfehler.
      expect(component.codeInput).toBe('K7QF3MX');
      // Auch ein Formfehler raeumt die Adresse: Ein gueltiger, aber vom Server
      // abgelehnter Code bliebe sonst stehen und verbrannte bei jedem
      // Neuladen einen Drosselversuch.
      expect(replacedPaths).toEqual(['/spielsekretariat']);
    });

    // Der Code bleibt gueltig; wer ihn im Feld stehen hat, drueckt einfach
    // noch einmal auf Weiter. Ein zweiter Scan ginge auch.
    it('laesst den Code im Feld stehen, wenn das Einloesen scheitert', () => {
      queryParams = { code: 'K7QF3MXR' };
      currentPath = '/spielsekretariat?code=K7QF3MXR';

      component.ngOnInit();
      httpMock
        .expectOne(redeemUrl)
        .flush({}, { status: 502, statusText: 'Bad Gateway' });

      expect(component.showCodeForm).toBe(true);
      expect(component.codeInput).toBe('K7QF3MXR');
      expect(component.codeError).toContain('bleibt gültig');
      // Ohne das bliebe die Seite auf „Lade Daten…" stehen, und die Meldung
      // am Feld haette gar keinen Platz -- das Template rendert sie nur unter
      // `!loading && showCodeForm`.
      expect(component.loading).toBe(false);
      expect(replacedPaths).toEqual(['/spielsekretariat']);
    });

    // Der Befund, der diesen Weg gefaehrlich machte: Der Code ist aus der
    // Adresse gestrichen, das Einloesen scheitert (429 aus der Drossel ist der
    // wahrscheinlichste Grund, weil sich die Halle eine IP teilt) -- und der
    // Reflex am Spieltisch ist F5. Bliebe der Token von gestern liegen, zeigte
    // das Neuladen kommentarlos den falschen Spieltag: kein Fehler, keine
    // Meldung, eine Seite, die richtig aussieht.
    it('faellt nach einem gescheiterten Einloesen nicht auf den alten Token zurueck', () => {
      sessionStorage.setItem('secretary_token', 'alter-token');
      queryParams = { code: 'K7QF3MXR' };
      currentPath = '/spielsekretariat?code=K7QF3MXR';

      component.ngOnInit();
      httpMock
        .expectOne(redeemUrl)
        .flush({}, { status: 429, statusText: 'Too Many Requests' });

      expect(sessionStorage.getItem('secretary_token')).toBeNull();

      // Das Neuladen: dieselbe Registerkarte, Adresse ohne Code.
      queryParams = {};
      currentPath = '/spielsekretariat';
      const nachDemNeuladen = TestBed.createComponent(
        SpielSekretariatComponent
      );
      nachDemNeuladen.componentInstance.ngOnInit();

      httpMock.expectNone(
        environment.apiURL + 'public/secretary?token=alter-token'
      );
      expect(nachDemNeuladen.componentInstance.showCodeForm).toBe(true);
    });

    // Der Token ist gueltig, nur der Spieltagsabruf kam nicht durch. Die
    // Meldung sagt „Der Zugang bleibt gueltig -- bitte die Seite neu laden";
    // das stimmt nur, wenn er auch abgelegt ist. Der Code steht ja nicht mehr
    // in der Adresse, ein Neuladen haette ihn sonst nicht mehr.
    it('legt den Token ab, auch wenn der Spieltag danach nicht laedt', () => {
      queryParams = { code: 'K7QF3MXR' };
      currentPath = '/spielsekretariat?code=K7QF3MXR';

      component.ngOnInit();
      httpMock.expectOne(redeemUrl).flush({
        token: 'langer-token',
        expires_at: '2026-01-02T00:00:00Z',
      });
      httpMock
        .expectOne(loadUrl)
        .flush({}, { status: 502, statusText: 'Bad Gateway' });

      expect(sessionStorage.getItem('secretary_token')).toBe('langer-token');
      expect(component.error).toContain('bleibt gültig');
    });

    // Ein abgeschnittener QR-Code oder ein in der Mail umgebrochener Link
    // liefert `?code=` ohne Wert. Das ist etwas anderes als „gar kein Code":
    // Still auf den abgelegten Token zurueckzufallen hiesse, den gescannten
    // Spieltag durch einen anderen zu ersetzen, ohne es zu sagen.
    it('meldet einen leeren Code aus der Adresse an der Maske', () => {
      sessionStorage.setItem('secretary_token', 'alter-token');
      queryParams = { code: '' };
      currentPath = '/spielsekretariat?code=';

      component.ngOnInit();

      httpMock.expectNone(redeemUrl);
      httpMock.expectNone(
        environment.apiURL + 'public/secretary?token=alter-token'
      );
      expect(component.showCodeForm).toBe(true);
      expect(component.codeError).toBeTruthy();
      expect(replacedPaths).toEqual(['/spielsekretariat']);
    });

    // Location und der Snapshot der Route sind zwei Quellen. Laufen sie
    // auseinander -- Umleitung, Server-Rendering --, darf die Adresse nicht
    // ohne Not neu geschrieben werden.
    it('schreibt die Adresse nicht zurueck, wenn sie keinen Suchteil hat', () => {
      queryParams = { code: 'K7QF3MXR' };
      currentPath = '/spielsekretariat';

      component.ngOnInit();

      expect(replacedPaths).toEqual([]);
      httpMock.expectOne(redeemUrl);
    });

    // Zeichengenau: URLSearchParams schriebe aus einem Leerzeichen ein `+`
    // zurueck, das Angulars UrlSerializer als Pluszeichen zurueckliest.
    it('laesst die Kodierung der uebrigen Parameter unveraendert', () => {
      queryParams = { code: 'K7QF3MXR', zurueck: '/fd/42/spiel/7' };
      currentPath =
        '/spielsekretariat?code=K7QF3MXR&zurueck=/fd/42/spiel/7&hinweis=Halle%202';

      component.ngOnInit();

      expect(replacedPaths).toEqual([
        '/spielsekretariat?zurueck=/fd/42/spiel/7&hinweis=Halle%202',
      ]);
      httpMock.expectOne(redeemUrl);
    });
  });

  describe('Zugang behalten', () => {
    const loadUrl = environment.apiURL + 'public/secretary?token=langer-token';
    const payload = {
      game_day: null,
      game_days: [day({ id: 1 })],
      games: [],
      license_lists: {},
      expires_at: '2026-01-02T00:00:00Z',
    };

    beforeEach(() => {
      queryParams = {};
    });

    // Vorher loeschte JEDER Fehler den Token. Ein kurzer Netzaussetzer oder ein
    // Neustart der API mitten im Spiel nahm damit den einzigen Zugang der
    // Registerkarte, obwohl ein zweites Neuladen ihn zurueckgeholt haette.
    it('behaelt den abgelegten Token bei einem voruebergehenden Fehler', () => {
      sessionStorage.setItem('secretary_token', 'langer-token');

      component.ngOnInit();
      httpMock
        .expectOne(loadUrl)
        .flush({}, { status: 502, statusText: 'Bad Gateway' });

      expect(sessionStorage.getItem('secretary_token')).toBe('langer-token');
      expect(component.showCodeForm).toBe(false);
      expect(component.error).toContain('bleibt gültig');
    });

    // Der Service wirft bei unbrauchbarer Antwort einen eigenen Error. Die
    // Eingabe darf dann nicht erscheinen: Ein neuer Code scheiterte genauso.
    it('bietet bei einer unbrauchbaren Antwort keine neue Eingabe an', () => {
      sessionStorage.setItem('secretary_token', 'langer-token');

      component.ngOnInit();
      httpMock.expectOne(loadUrl).flush({ game_days: [] });

      expect(component.showCodeForm).toBe(false);
      expect(sessionStorage.getItem('secretary_token')).toBe('langer-token');
    });

    // Die Meldung des vorigen Anlaufs darf nicht ueber dem geladenen Spieltag
    // stehen bleiben.
    it('raeumt die alte Fehlermeldung ab, sobald der Spieltag laedt', () => {
      sessionStorage.setItem('secretary_token', 'langer-token');
      component.error = 'Der Link ist ungültig oder abgelaufen.';
      component.ngOnInit();

      httpMock.expectOne(loadUrl).flush(payload);

      expect(component.error).toBeUndefined();
    });

    // `revoke_coverage_of` entwertet nur Links derselben Spieltage -- der
    // Zugang von Samstag gilt am Sonntag noch, und ohne diesen Weg laedt
    // dieselbe Registerkarte kommentarlos den Spieltag von gestern.
    it('kommt vom geladenen Spieltag zurueck zur Eingabe', () => {
      sessionStorage.setItem('secretary_token', 'langer-token');
      component.ngOnInit();
      httpMock.expectOne(loadUrl).flush(payload);

      component.enterDifferentCode();

      expect(component.showCodeForm).toBe(true);
      expect(component.data).toBeUndefined();
      expect(sessionStorage.getItem('secretary_token')).toBeNull();
    });
  });
});
