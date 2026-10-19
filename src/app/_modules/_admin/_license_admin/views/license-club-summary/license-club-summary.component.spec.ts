import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { getTranslocoTestingModule } from '@floorball/core';
import { ClubLicenseSummary } from '@floorball/types';
import { environment } from 'src/environments/environment';
import { LicenseClubSummaryComponent } from './license-club-summary.component';

describe('LicenseClubSummaryComponent', () => {
  let http: HttpTestingController;
  const url = `${environment.apiURL}vm/clubs/113/license_summary.json`;

  const counts = (approved: number, requested: number) => ({
    approved,
    requested,
    denied: 0,
    withdrawn: 0,
    other: 0,
    total: approved + requested,
  });

  const summary = (seasonId: number): ClubLicenseSummary => ({
    club: { id: 113, name: 'TSV Rohrdorf-Thansau' },
    season_id: seasonId,
    seasons: [
      { id: 18, name: '2026/2027' },
      { id: 17, name: '2025/2026' },
    ],
    teams: [
      {
        id: 1,
        name: 'Herren',
        league_name: 'Regionalliga',
        counts: counts(12, 3),
      },
    ],
    totals: counts(12, 3),
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, getTranslocoTestingModule()],
      declarations: [LicenseClubSummaryComponent],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function create() {
    const fixture = TestBed.createComponent(LicenseClubSummaryComponent);
    fixture.componentRef.setInput('clubId', 113);
    fixture.detectChanges();
    return fixture;
  }

  it('laedt ohne Saisonangabe und zeigt Mannschaft und Summe', () => {
    const fixture = create();
    const req = http.expectOne((r) => r.url === url);
    expect(req.request.params.has('season_id')).toBeFalse();
    req.flush(summary(18));
    fixture.detectChanges();

    const total = fixture.nativeElement.querySelector(
      '[data-testid="license-summary-total"]'
    ).textContent;
    expect(total).toContain('12');
    expect(total).toContain('15');
    expect(fixture.nativeElement.textContent).toContain('Herren');
  });

  it('fragt beim Saisonwechsel die gewaehlte Saison ab', () => {
    const fixture = create();
    http.expectOne((r) => r.url === url).flush(summary(18));

    fixture.componentInstance.selectSeason('17');

    const req = http.expectOne((r) => r.url === url);
    expect(req.request.params.get('season_id')).toBe('17');
    req.flush(summary(17));
    expect(fixture.componentInstance.summary?.season_id).toBe(17);
  });

  // Sonst stuende unter der neuen Auswahl die Tabelle der alten Saison.
  it('raeumt bei einem Fehler die alte Saison ab', () => {
    const fixture = create();
    http.expectOne((r) => r.url === url).flush(summary(18));

    fixture.componentInstance.selectSeason('17');
    http
      .expectOne((r) => r.url === url)
      .flush('', { status: 500, statusText: 'Server Error' });

    expect(fixture.componentInstance.summary).toBeNull();
    expect(fixture.componentInstance.loadFailed).toBeTrue();
  });

  // Die Auswahl darf mit der Tabelle nicht verschwinden, sonst kaeme man nach
  // einem gescheiterten Wechsel nur per Neuladen zurueck.
  it('behaelt nach einem Fehler Saisonauswahl und bietet Wiederholen an', () => {
    const fixture = create();
    http.expectOne((r) => r.url === url).flush(summary(18));
    fixture.detectChanges();

    const select: HTMLSelectElement = fixture.nativeElement.querySelector(
      '[data-testid="license-summary-season"]'
    );
    select.value = '17';
    select.dispatchEvent(new Event('change'));
    http
      .expectOne((r) => r.params.get('season_id') === '17')
      .flush('', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="license-summary-season"]'
      )
    ).not.toBeNull();
    fixture.nativeElement
      .querySelector('[data-testid="license-summary-retry"]')
      .click();
    http
      .expectOne((r) => r.params.get('season_id') === '17')
      .flush(summary(17));
    expect(fixture.componentInstance.summary?.season_id).toBe(17);
  });
});
