import { TestBed } from '@angular/core/testing';

import { LicenseAdminLeagueDetailComponent } from './license-admin-league-detail.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { getTranslocoTestingModule } from '@floorball/core';
import { PlayerWithLicense } from '@floorball/types';

describe('LicenseAdminLeagueDetailComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [LicenseAdminLeagueDetailComponent],
    })
      .overrideTemplate(LicenseAdminLeagueDetailComponent, '')
      .compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(LicenseAdminLeagueDetailComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  // Das Einverständnis-Kennzeichen hing vorher allein am Geburtsdatum und stand
  // deshalb auch in Ligen ohne diese Pflicht.
  describe('needsParentalConsent', () => {
    function player(requiredDocuments?: string[]): PlayerWithLicense {
      return {
        birthdate: '2012-05-04',
        team_license: { required_documents: requiredDocuments },
      } as unknown as PlayerWithLicense;
    }

    it('folgt der serverseitig aufgelösten Liste', () => {
      const component = TestBed.createComponent(
        LicenseAdminLeagueDetailComponent
      ).componentInstance;

      expect(component.needsParentalConsent(player(['parental_consent']))).toBe(
        true
      );
      expect(component.needsParentalConsent(player([]))).toBe(false);
      expect(component.needsParentalConsent(player(undefined))).toBe(false);
    });
  });
});
