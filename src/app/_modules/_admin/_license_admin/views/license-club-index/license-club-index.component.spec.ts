import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LicenseClubIndexComponent } from './license-club-index.component';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { getTranslocoTestingModule } from '@floorball/core';
import { LicenseClubSummaryComponent } from '../license-club-summary/license-club-summary.component';
import { CollapsibleComponent } from 'src/app/_modules/_uikit/_common/components/molecules/collapsible/collapsible.component';
import { environment } from 'src/environments/environment';

describe('LicenseClubIndexComponent', () => {
  let component: LicenseClubIndexComponent;
  let fixture: ComponentFixture<LicenseClubIndexComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [
        LicenseClubIndexComponent,
        LicenseClubSummaryComponent,
        CollapsibleComponent,
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LicenseClubIndexComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Regression: Die Ansicht lud ihre Vereine aus user/clubs_and_teams. Das ist
  // über alle Rollen additiv, wer neben der VM-Rolle auch SBK ist, bekam damit
  // alle Vereine des Spielbetriebs in eine Ansicht, die den eigenen
  // Beantragungsprozess meint.
  it('lädt nur die eigenen VM-/TM-Vereine, nicht den Spielbetriebs-Bestand', () => {
    http.expectNone(`${environment.apiURL}user/clubs_and_teams.json`);
    const req = http.expectOne(`${environment.apiURL}vm/clubs_and_teams.json`);
    req.flush([{ id: 113, name: 'TSV Rohrdorf-Thansau', teams: [] }]);

    expect(component.clubAndTeams.length).toBe(1);
    expect(component.clubAndTeams[0].id).toBe(113);
  });

  const summaryUrl = (id: number) =>
    `${environment.apiURL}vm/clubs/${id}/license_summary.json`;

  function flushClubs() {
    http.expectOne(`${environment.apiURL}vm/clubs_and_teams.json`).flush([
      {
        id: 113,
        name: 'TSV Rohrdorf-Thansau',
        teams: [],
        license_summary: true,
      },
      { id: 114, name: 'Nur Teammanager', teams: [], license_summary: false },
    ]);
    fixture.detectChanges();
  }

  function toggleSummary(index: number) {
    const details: HTMLDetailsElement = fixture.nativeElement.querySelectorAll(
      '[data-testid="license-summary-card"] details'
    )[index];
    details.open = !details.open;
    details.dispatchEvent(new Event('toggle'));
    fixture.detectChanges();
  }

  // Die Lizenzzahlen sind selten gefragt; der Abruf je Verein lief vorher bei
  // jedem Seitenaufruf.
  it('laedt die Lizenzzahlen nicht, solange der Bereich zu ist', () => {
    flushClubs();

    http.expectNone(summaryUrl(113));
    expect(
      fixture.nativeElement.querySelector('[data-testid="license-summary"]')
    ).toBeNull();
  });

  it('laedt die Lizenzzahlen genau einmal beim Aufklappen', () => {
    flushClubs();
    toggleSummary(0);

    const req = http.expectOne(summaryUrl(113));
    expect(req.request.method).toBe('GET');
    expect(component.summaryOpen[113]).toBeTrue();
    // Eingebettet: keine zweite Ueberschrift unter dem Aufklapp-Schalter.
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="license-summary-title"]'
      )
    ).toBeNull();
  });

  // Zuklappen darf die Uebersicht nicht abbauen: Sonst ging die gewaehlte
  // Saison verloren und jedes Aufklappen fragte erneut ab.
  it('behaelt Uebersicht und Saisonwahl ueber Zu- und Aufklappen', () => {
    flushClubs();
    toggleSummary(0);
    http.expectOne(summaryUrl(113)).flush({
      club: { id: 113, name: 'TSV Rohrdorf-Thansau' },
      season_id: 18,
      seasons: [
        { id: 18, name: '2026/2027' },
        { id: 17, name: '2025/2026' },
      ],
      teams: [],
      totals: {
        approved: 0,
        requested: 0,
        denied: 0,
        withdrawn: 0,
        other: 0,
        total: 0,
      },
    });
    fixture.detectChanges();

    const select = (): HTMLSelectElement =>
      fixture.nativeElement.querySelector(
        '[data-testid="license-summary-season"]'
      );
    select().value = '17';
    select().dispatchEvent(new Event('change'));
    const req = http.expectOne((r) => r.url === summaryUrl(113));
    expect(req.request.params.get('season_id')).toBe('17');
    req.flush({
      club: { id: 113, name: 'TSV Rohrdorf-Thansau' },
      season_id: 17,
      seasons: [
        { id: 18, name: '2026/2027' },
        { id: 17, name: '2025/2026' },
      ],
      teams: [],
      totals: {
        approved: 0,
        requested: 0,
        denied: 0,
        withdrawn: 0,
        other: 0,
        total: 0,
      },
    });
    fixture.detectChanges();

    toggleSummary(0);
    expect(component.summaryOpen[113]).toBeFalse();
    toggleSummary(0);

    http.expectNone((r) => r.url === summaryUrl(113));
    expect(select().value).toBe('17');
  });

  // Die Liste enthaelt auch Vereine, in denen das Konto nur Teammanager ist.
  // Dort antwortet die Lizenzuebersicht mit 403, und der ErrorInterceptor
  // leitete auf die Startseite um. Massgeblich ist das Flag der API, nicht
  // `club_ids` im localStorage, der nach einem Rollenentzug alt steht.
  it('bietet die Lizenzzahlen nur fuer Vereine an, die die API freigibt', () => {
    flushClubs();

    expect(
      fixture.nativeElement.querySelectorAll(
        '[data-testid="license-summary-card"]'
      ).length
    ).toBe(1);
    toggleSummary(0);
    http.expectOne(summaryUrl(113));
    http.expectNone(summaryUrl(114));
  });
});
