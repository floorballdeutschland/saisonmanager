import { TestBed } from '@angular/core/testing';

import { LicenseUserLeagueDetailComponent } from './license-user-league-detail.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { FormsModule } from '@angular/forms';
import { getTranslocoTestingModule } from '@floorball/core';
import { UikitPlayerModule } from '@floorball/uikit/player';
import { IconsModule } from '../../../../_uikit/_icons/icons.module';
import { TeamWithPlayers } from '@floorball/types';

describe('LicenseUserLeagueDetailComponent', () => {
  const STORAGE_KEY = 'license_list_show_dates';

  const configure = () =>
    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        // currentAge-Pipe und Brillensymbol der Spielerzeile; ohne beide
        // rendert die Zeile nicht.
        UikitPlayerModule,
        IconsModule,
        // Wegen des ngModel der Spieltags-Datumsauswahl; ohne den meldet das
        // erste Rendern NG0303 auf der Konsole.
        FormsModule,
        // Alias als Wurzel unter der Sprache, wie in den Nachbar-Specs des
        // Moduls: Ein anderes Format lässt die Schlüssel roh durchrendern.
        getTranslocoTestingModule({
          de: {
            licenseAdmin: {
              userLeagueDetail: {
                requested: 'Beantragt',
                approved: 'Erteilt',
                released: 'Freigabe',
                suspendedLabel: 'Gesperrt:',
                gamesRemaining: 'noch {{ remaining }} von {{ total }} Spielen',
                suspendedUntil: 'bis',
              },
            },
          },
        }),
      ],
      declarations: [LicenseUserLeagueDetailComponent],
    });

  beforeEach(async () => {
    localStorage.removeItem(STORAGE_KEY);
    await configure().compileComponents();
  });

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  const create = () => {
    const fixture = TestBed.createComponent(LicenseUserLeagueDetailComponent);
    fixture.detectChanges();
    return fixture;
  };

  it('should create', () => {
    expect(create().componentInstance).toBeTruthy();
  });

  describe('Schalter für die Datumsangaben', () => {
    // Die Feldvorgabe wird vor detectChanges() weggenommen: Sonst wäre der Test
    // auch dann grün, wenn ngOnInit den gespeicherten Wert gar nicht liest.
    const createWithoutDefault = () => {
      const fixture = TestBed.createComponent(LicenseUserLeagueDetailComponent);
      fixture.componentInstance.showDates = false;
      fixture.detectChanges();
      return fixture.componentInstance;
    };

    it('zeigt die Datumsangaben ohne gespeicherte Wahl an', () => {
      expect(createWithoutDefault().showDates).toBeTrue();
    });

    it('merkt sich das Abwählen über den Aufruf hinaus', () => {
      create().componentInstance.toggleDates(false);

      expect(localStorage.getItem(STORAGE_KEY)).toBe('false');

      TestBed.resetTestingModule();
      configure();

      expect(create().componentInstance.showDates).toBeFalse();
    });

    it('zeigt die Datumsangaben bei unbrauchbarem gespeichertem Wert', () => {
      // Rest einer früheren Fassung oder von Hand gesetzt: Alles außer 'false'
      // darf die Angaben nicht verstecken.
      localStorage.setItem(STORAGE_KEY, 'vielleicht');

      expect(createWithoutDefault().showDates).toBeTrue();
    });

    it('zeigt die Datumsangaben, wenn localStorage nicht lesbar ist', () => {
      spyOn(localStorage, 'getItem').and.throwError('SecurityError');

      expect(createWithoutDefault().showDates).toBeTrue();
    });

    it('bleibt bedienbar, wenn localStorage nicht schreibbar ist', () => {
      spyOn(localStorage, 'setItem').and.throwError('QuotaExceededError');
      const component = create().componentInstance;

      expect(() => component.toggleDates(false)).not.toThrow();
      expect(component.showDates).toBeFalse();
    });
  });

  describe('Anzeige der Datumsangaben', () => {
    const teams = (releasedAt: string | null): TeamWithPlayers[] =>
      [
        {
          id: 1,
          name: 'Musterstadt',
          players: [
            {
              id: 7,
              last_name: 'Meier',
              first_name: 'Anna',
              birthdate: '1990-01-01',
              team_license: {
                last_status: { license_status_id: 1 },
                last_status_code: 'Lizenz erteilt',
                license: {},
                requested_at: '2026-01-05T10:00:00Z',
                approved_at: '2026-01-08T10:00:00Z',
                released_at: releasedAt,
              },
            },
          ],
        },
      ] as unknown as TeamWithPlayers[];

    // Ohne gamedayDate greift das @if um die Liste nicht und es wird nichts
    // gerendert – die Auswahl ist Voraussetzung der Ansicht.
    // Der Schalter wird über den gespeicherten Wert vorgegeben statt nach dem
    // ersten Rendern gesetzt: So läuft ngOnInit einmal mit dem Endzustand, und
    // der Test erzeugt keinen NG0100 aus einer nachträglichen Änderung.
    const render = (releasedAt: string | null, showDates = true): string => {
      if (!showDates) localStorage.setItem(STORAGE_KEY, 'false');
      const fixture = TestBed.createComponent(LicenseUserLeagueDetailComponent);
      fixture.componentInstance.setGamedayDate(0);
      fixture.componentInstance.teams = teams(releasedAt);
      fixture.detectChanges();
      return fixture.nativeElement.textContent ?? '';
    };

    it('zeigt Beantragung, Erteilung und Freigabe', () => {
      const text = render('2026-01-10T10:00:00Z');

      expect(text).toContain('Beantragt');
      expect(text).toContain('05.01.26');
      expect(text).toContain('Erteilt');
      expect(text).toContain('08.01.26');
      expect(text).toContain('Freigabe');
      expect(text).toContain('10.01.26');
      // Ein vertippter Schlüsselpfad rendert den rohen Punktpfad in die Seite.
      expect(text).not.toContain('userLeagueDetail.released');
    });

    it('lässt die Freigabe weg, wenn der Spieler keine hat', () => {
      const text = render(null);

      // Beantragt und Erteilt behalten ihr Datum, nur die Freigabe entfällt –
      // die meisten Spieler brauchen keine.
      expect(text).toContain('Beantragt');
      expect(text).toContain('05.01.26');
      expect(text).not.toContain('Freigabe');
    });

    it('blendet alle drei Angaben aus, wenn der Schalter aus ist', () => {
      const text = render('2026-01-10T10:00:00Z', false);

      expect(text).toContain('Meier');
      expect(text).not.toContain('Beantragt');
      expect(text).not.toContain('Erteilt');
      expect(text).not.toContain('Freigabe');
    });
  });

  // Der wirksame Status einer Zeile ist `last_status_id`; `last_status` bleibt
  // der GESPEICHERTE Eintrag. Bei einer Sperre auf einen Wettbewerb oder eine
  // Liga steht dort weiter „erteilt", weil dieselbe Lizenz im Pokal gilt --
  // die Zeile war deshalb grün und trug daneben den Text „gesperrt".
  describe('Markierung einer Sperre', () => {
    const teams = (
      lastStatusId: number,
      suspension: unknown
    ): TeamWithPlayers[] =>
      [
        {
          id: 1,
          name: 'Musterstadt',
          players: [
            {
              id: 7,
              last_name: 'Meier',
              first_name: 'Anna',
              birthdate: '1990-01-01',
              team_license: {
                // Der gespeicherte Status bleibt bewusst erteilt.
                last_status: { license_status_id: 1 },
                last_status_id: lastStatusId,
                last_status_code: lastStatusId === 9 ? 'gesperrt' : 'erteilt',
                license: {},
                requested_at: '2026-01-05T10:00:00Z',
                approved_at: '2026-01-08T10:00:00Z',
                suspension,
              },
            },
          ],
        },
      ] as unknown as TeamWithPlayers[];

    const render = (lastStatusId: number, suspension: unknown) => {
      const fixture = TestBed.createComponent(LicenseUserLeagueDetailComponent);
      fixture.componentInstance.setGamedayDate(0);
      fixture.componentInstance.teams = teams(lastStatusId, suspension);
      fixture.detectChanges();
      return fixture;
    };

    const sperre = {
      scope_summary: 'Herren Großfeld, Ligaspielbetrieb',
      games_total: 3,
      games_served: 1,
      remaining_games: 2,
      valid_until: '2026-10-31',
    };

    it('färbt die gesperrte Zeile rot und nennt Geltungsbereich und Dauer', () => {
      const fixture = render(9, sperre);
      const badge = fixture.nativeElement.querySelector('.license-status');
      const text = fixture.nativeElement.textContent ?? '';

      expect(badge.className).toContain('bg-red-100');
      expect(badge.className).not.toContain('bg-green-100');
      expect(text).toContain('Gesperrt:');
      expect(text).toContain('Herren Großfeld, Ligaspielbetrieb');
      expect(text).toContain('noch 2 von 3 Spielen');
      expect(text).toContain('bis');
      expect(text).toContain('31.10.2026');
    });

    // Die Liste lesen Verein und Mannschaft. Warum jemand gesperrt ist, bleibt
    // der Verbandsansicht vorbehalten.
    it('nennt die Begründung der Sperre nicht', () => {
      const fixture = render(9, {
        ...sperre,
        reason: 'Unsportliches Verhalten',
      });

      expect(fixture.nativeElement.textContent).not.toContain('Unsportliches');
    });

    // Eine Sperre traegt entweder ein Enddatum oder eine Anzahl Spiele; beides
    // zugleich ist die Ausnahme. Mit einer Vorgabe, die immer beides setzt,
    // waeren die zwei Bedingungen im Template nicht auseinanderzuhalten.
    it('nennt bei einer Sperre über Spiele kein Datum', () => {
      const fixture = render(9, {
        scope_summary: 'Herren Großfeld, Ligaspielbetrieb',
        games_total: 3,
        games_served: 1,
        remaining_games: 2,
        valid_until: null,
      });
      const text = fixture.nativeElement.textContent ?? '';

      expect(text).toContain('noch 2 von 3 Spielen');
      expect(text).not.toContain('bis');
    });

    it('nennt bei einer Sperre bis zu einem Datum keine Spiele', () => {
      const fixture = render(9, {
        scope_summary: 'Herren Großfeld, Ligaspielbetrieb',
        games_total: null,
        remaining_games: null,
        valid_until: '2026-10-31',
      });
      const text = fixture.nativeElement.textContent ?? '';

      expect(text).toContain('31.10.2026');
      expect(text).not.toContain('Spielen');
    });

    // Die letzte Partie einer Sperre: Der Reststand steht auf null und die
    // Sperre laeuft noch, bis der Bericht abgeschlossen ist.
    it('zeigt den Reststand auch bei null', () => {
      const fixture = render(9, {
        scope_summary: 'Herren Großfeld, Ligaspielbetrieb',
        games_total: 3,
        remaining_games: 0,
        valid_until: null,
      });

      expect(fixture.nativeElement.textContent).toContain(
        'noch 0 von 3 Spielen'
      );
    });

    it('lässt eine erteilte Zeile grün und ohne Hinweis', () => {
      const fixture = render(1, null);
      const badge = fixture.nativeElement.querySelector('.license-status');

      expect(badge.className).toContain('bg-green-100');
      expect(fixture.nativeElement.textContent).not.toContain('Gesperrt:');
    });
  });
});
