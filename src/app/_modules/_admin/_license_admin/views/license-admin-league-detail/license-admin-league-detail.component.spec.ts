import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Params } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

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

  // Aus der Übersicht kommt der Spieler als ?spieler=<id> mit. Ohne ihn wäre
  // der Antrag in einer Liga mit vielen offenen Anträgen erneut zu suchen.
  describe('angesprungener Spieler', () => {
    const params$ = new BehaviorSubject<Params>({ leagueId: '7' });
    const query$ = new BehaviorSubject<Params>({});

    beforeEach(async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [HttpClientTestingModule, getTranslocoTestingModule()],
        declarations: [LicenseAdminLeagueDetailComponent],
        providers: [
          {
            provide: ActivatedRoute,
            useValue: { params: params$, queryParams: query$ },
          },
        ],
      })
        .overrideTemplate(LicenseAdminLeagueDetailComponent, '')
        .compileComponents();
    });

    function player(id: number): PlayerWithLicense {
      return { id } as unknown as PlayerWithLicense;
    }

    function create(query: Params): LicenseAdminLeagueDetailComponent {
      query$.next(query);
      const fixture = TestBed.createComponent(
        LicenseAdminLeagueDetailComponent
      );
      fixture.detectChanges();
      return fixture.componentInstance;
    }

    it('klappt seinen Antrag auf, nicht den ersten der Liste', () => {
      const component = create({ spieler: '42' });

      expect(component.isInitiallyOpen(player(42), 3, 5)).toBe(true);
      expect(component.isInitiallyOpen(player(11), 0, 0)).toBe(false);
    });

    it('bleibt ohne Parameter beim ersten Antrag', () => {
      const component = create({});

      expect(component.isInitiallyOpen(player(11), 0, 0)).toBe(true);
      expect(component.isInitiallyOpen(player(42), 1, 0)).toBe(false);
    });

    it('verwirft einen Parameter, der keine Zahl ist', () => {
      const component = create({ spieler: 'abc' });

      expect(component.focusPlayerId).toBeUndefined();
      expect(component.isInitiallyOpen(player(11), 0, 0)).toBe(true);
    });
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
