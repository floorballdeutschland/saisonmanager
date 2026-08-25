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
      const fixture = TestBed.createComponent(
        LicenseUserLeagueDetailComponent
      );
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
      const fixture = TestBed.createComponent(
        LicenseUserLeagueDetailComponent
      );
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
});
