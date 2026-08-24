import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Params } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { LicenseAdminLeagueDetailComponent } from './license-admin-league-detail.component';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
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

  describe('angesprungener Spieler', () => {
    const params$ = new BehaviorSubject<Params>({ leagueId: '7' });
    const query$ = new BehaviorSubject<Params>({});
    let http: HttpTestingController;
    let fixture: ComponentFixture<LicenseAdminLeagueDetailComponent>;
    const anchors: HTMLElement[] = [];

    beforeEach(async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [HttpClientTestingModule, getTranslocoTestingModule()],
        declarations: [LicenseAdminLeagueDetailComponent],
        providers: [
          {
            provide: ActivatedRoute,
            useValue: {
              params: params$,
              queryParams: query$,
              snapshot: { params: { leagueId: '7' } },
            },
          },
        ],
      })
        .overrideTemplate(LicenseAdminLeagueDetailComponent, '')
        .compileComponents();
      http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
      while (anchors.length) anchors.pop()?.remove();
    });

    function player(id: number): PlayerWithLicense {
      return { id } as unknown as PlayerWithLicense;
    }

    // Die Sprungziele stehen sonst im echten Template, das diese Specs
    // ersetzen; scrollToFocusedPlayer() sucht sie ohnehin nur per ID.
    function anchor(id: string): HTMLElement {
      const element = document.createElement('div');
      element.id = id;
      document.body.appendChild(element);
      anchors.push(element);
      return element;
    }

    // Erst mit den beantworteten Anfragen rendert die Liste, und erst danach
    // laeuft der afterNextRender-Haken mit dem Sprung.
    function loadLeague(): void {
      http.match(() => true).forEach((request) => request.flush([]));
      fixture.detectChanges();
    }

    function create(query: Params): LicenseAdminLeagueDetailComponent {
      query$.next(query);
      fixture = TestBed.createComponent(LicenseAdminLeagueDetailComponent);
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

    it('springt zum offenen Antrag', () => {
      const target = anchor('antrag-42');
      const scroll = spyOn(target, 'scrollIntoView');
      create({ spieler: '42' });

      loadLeague();

      expect(scroll).toHaveBeenCalledTimes(1);
    });

    // Die Uebersicht verlinkt jede Lizenz, nicht nur die beantragten: fuer
    // eine laengst erteilte gibt es gar keinen Antrag mehr.
    it('springt zur Mannschaftszeile, wenn kein Antrag mehr offen ist', () => {
      const row = anchor('spieler-42');
      const scroll = spyOn(row, 'scrollIntoView');
      create({ spieler: '42' });

      loadLeague();

      expect(scroll).toHaveBeenCalledTimes(1);
    });

    // Jede Entscheidung laedt die Liga neu, auch die zu einem anderen Antrag.
    // Ein zweiter Sprung risse die Ansicht aus der gerade bearbeiteten Stelle.
    it('springt nur beim ersten Laden', () => {
      const request = anchor('antrag-42');
      const scroll = spyOn(request, 'scrollIntoView');
      const component = create({ spieler: '42' });
      loadLeague();

      component.handledPlayer(11);
      loadLeague();

      expect(scroll).toHaveBeenCalledTimes(1);
    });

    // Ohne das Zuruecksetzen bliebe der Rest des Besuchs zugeklappt, weil
    // isInitiallyOpen() dann jeden Antrag am erledigten Spieler misst.
    it('gibt den ersten Antrag wieder frei, sobald er entschieden ist', () => {
      const component = create({ spieler: '42' });
      loadLeague();

      component.handledPlayer(42);

      expect(component.focusPlayerId).toBeUndefined();
      expect(component.isInitiallyOpen(player(11), 0, 0)).toBe(true);
    });

    // Der Router meldet bei gleichem Pfad nur queryParams; ohne das Nachladen
    // bliebe die Seite auf dem zuerst angesprungenen Spieler stehen.
    it('laedt die Liga neu, wenn nur der Spieler wechselt', () => {
      const component = create({ spieler: '42' });
      loadLeague();

      query$.next({ spieler: '43' });

      expect(http.match(() => true).length).toBeGreaterThan(0);
      expect(component.focusPlayerId).toBe(43);
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
