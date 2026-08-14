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
});
