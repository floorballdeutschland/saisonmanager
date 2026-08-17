import { TestBed } from '@angular/core/testing';

import { LicenseTeamDetailComponent } from './license-team-detail.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { getTranslocoTestingModule } from '@floorball/core';
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
  // Deren Verband bearbeitet den Antrag und stellt die Zusatzkosten, und das kann
  // eine Pokal-Liga sein, die der Verein im Formular sonst nirgends sieht (#455).
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
});
