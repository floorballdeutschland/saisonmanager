import { TestBed } from '@angular/core/testing';

import { LicenseTeamDetailComponent } from './license-team-detail.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { FormsModule } from '@angular/forms';
import { getTranslocoTestingModule } from '@floorball/core';
import { UikitCommonModule } from '@floorball/uikit/common';
import { LicenseHash, PlayerWithLicense } from '@floorball/types';

describe('LicenseTeamDetailComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [LicenseTeamDetailComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(LicenseTeamDetailComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  // Der Upload der Elternzustimmung wurde vorher bei jeder minderjährigen
  // Person eingefordert, auch in Ligen, die sie gar nicht verlangen.
  describe('needsConsentFor', () => {
    function setup(
      requiredDocuments: string[] | undefined,
      flag = false
    ): {
      component: LicenseTeamDetailComponent;
      player: PlayerWithLicense;
    } {
      const fixture = TestBed.createComponent(LicenseTeamDetailComponent);
      const component = fixture.componentInstance;
      component.licenseHash = {
        parental_consent_required: flag,
      } as LicenseHash;
      const player = {
        id: 1,
        birthdate: '2012-05-04',
        required_documents: requiredDocuments,
      } as unknown as PlayerWithLicense;
      return { component, player };
    }

    it('fordert die Zustimmung, wenn die Liga sie verlangt', () => {
      const { component, player } = setup(['parental_consent'], true);

      expect(component.needsConsentFor(player)).toBe(true);
    });

    it('fordert sie nicht ohne Liga-Pflicht, auch bei Minderjährigen', () => {
      const { component, player } = setup([]);

      expect(component.needsConsentFor(player)).toBe(false);
    });

    it('greift ohne aufgelöste Liste auf das Liga-Flag zurück', () => {
      const withFlag = setup(undefined, true);
      expect(withFlag.component.needsConsentFor(withFlag.player)).toBe(true);

      const withoutFlag = setup(undefined);
      expect(withoutFlag.component.needsConsentFor(withoutFlag.player)).toBe(
        false
      );
    });
  });

  // Der Datenschutz-Hinweis nennt die Liga, die die Zustimmung verlangt. Ohne
  // sie las sich der Block wie eine Aussage über die 1. und 2. Bundesliga,
  // obwohl ihn auf Produktion auch Regionalligen auslösen.
  describe('parentalConsentLeagueName', () => {
    function componentWith(hash: Partial<LicenseHash>) {
      const fixture = TestBed.createComponent(LicenseTeamDetailComponent);
      fixture.componentInstance.licenseHash = hash as LicenseHash;
      return fixture.componentInstance;
    }

    it('gibt den Namen der auslösenden Liga zurück', () => {
      const component = componentWith({
        parental_consent_required: true,
        parental_consent_league: { id: 7, name: 'Regionalliga Bayern' },
      });

      expect(component.parentalConsentLeagueName).toBe('Regionalliga Bayern');
    });

    it('gibt null zurück, solange die API die Liga nicht mitliefert', () => {
      const component = componentWith({ parental_consent_required: true });

      expect(component.parentalConsentLeagueName).toBeNull();
    });
  });

  // Der Express-Hinweis nennt die Liga, wegen der die Expresslizenz möglich ist.
  // Das kann eine Pokal-Liga sein, deren Verband der Verein im Formular sonst
  // nirgends sieht (api#455).
  describe('expressLicenseLeagueName', () => {
    function componentWith(hash: Partial<LicenseHash>) {
      const fixture = TestBed.createComponent(LicenseTeamDetailComponent);
      fixture.componentInstance.licenseHash = hash as LicenseHash;
      return fixture.componentInstance;
    }

    it('gibt den Namen der erlaubenden Liga zurück', () => {
      const component = componentWith({
        express_license_enabled: true,
        express_license_league: { id: 12, name: 'FD-Pokal' },
      });

      expect(component.expressLicenseLeagueName).toBe('FD-Pokal');
    });

    it('gibt null zurück, solange die API die Liga nicht mitliefert', () => {
      const component = componentWith({ express_license_enabled: true });

      expect(component.expressLicenseLeagueName).toBeNull();
    });
  });

  // Der Getter allein sagt nichts über das, was der Verein liest. Bricht die
  // Verdrahtung Template ↔ i18n-Schlüssel ↔ Platzhalter, verschwindet der
  // Liganame lautlos: Bei einem Platzhalter, der nicht `league` heißt, rendert
  // der Satz als "Möglich ist sie wegen der Liga ." und in Produktion protokolliert
  // Transloco das nicht einmal (`logMissingKey: false`). Genau die Angabe, um die
  // es in diesem Fix geht, wäre dann weg, und die Getter-Specs bleiben grün.
  //
  // Die Übersetzung wird global gestellt (`de: { licenseAdmin: … }`), nicht als
  // Scope-Schlüssel `'admin/license/de'`: Letzteres bleibt in diesem TestBed
  // unaufgelöst, weil die Komponente hier ohne ihr Modul und damit ohne dessen
  // TRANSLOCO_SCOPE steht.
  describe('Express-Hinweis im Formular', () => {
    function render(hash: Partial<LicenseHash>): string {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [
          HttpClientTestingModule,
          RouterTestingModule,
          // Das Template braucht die Pipes aus dem UIKit (sortPlayers und
          // Nachbarn) und ngModel fuer die Formularfelder. Die Getter-Specs oben
          // rendern nicht und kommen ohne beides aus.
          UikitCommonModule,
          FormsModule,
          getTranslocoTestingModule({
            de: {
              licenseAdmin: {
                teamDetail: {
                  expressLeagueHint: 'Zuständig ist {{league}}.',
                },
              },
            },
          }),
        ],
        declarations: [LicenseTeamDetailComponent],
      });
      const fixture = TestBed.createComponent(LicenseTeamDetailComponent);
      // ngOnInit lädt nichts: ohne teamId-Param im Router bleibt
      // loadUserLicenses() aus, der Hash kommt hier direkt aus dem Test.
      fixture.componentInstance.licenseHash = {
        team: { id: 1, name: 'Musterstadt' },
        current_requests: [],
        other_players: [],
        ...hash,
      } as unknown as LicenseHash;
      fixture.detectChanges();
      return fixture.nativeElement.textContent ?? '';
    }

    it('nennt die Liga im Hinweis, mit aufgeloestem Platzhalter', () => {
      const text = render({
        express_license_enabled: true,
        express_license_league: { id: 12, name: 'FD-Pokal' },
      });

      expect(text).toContain('Zuständig ist FD-Pokal.');
      // Ein vertippter Schlüsselpfad rendert den rohen Punktpfad in die Seite.
      // Nur auf diesen einen Schlüssel prüfen: Der Test stellt bewusst nur ihn
      // bereit, alle übrigen Schlüssel der Seite stehen hier erwartungsgemäß roh.
      expect(text).not.toContain('expressLeagueHint');
    });

    // Der Hinweis hängt am Express-Häkchen, nicht am Liga-Feld. Stellt jemand das
    // äußere @if später auf expressLicenseLeagueName um, stünde die Ligazeile im
    // Formular, ohne dass die Expresslizenz überhaupt angeboten wird.
    it('zeigt den Hinweis nicht, wenn keine Liga die Expresslizenz erlaubt', () => {
      const text = render({
        express_license_enabled: false,
        express_license_league: { id: 12, name: 'FD-Pokal' },
      });

      expect(text).not.toContain('FD-Pokal');
    });
  });
});
