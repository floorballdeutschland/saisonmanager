import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LicenseClubIndexComponent } from './license-club-index.component';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { getTranslocoTestingModule } from '@floorball/core';
import { LicenseClubSummaryComponent } from '../license-club-summary/license-club-summary.component';
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
      declarations: [LicenseClubIndexComponent, LicenseClubSummaryComponent],
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

  // Die Liste enthaelt auch Vereine, in denen das Konto nur Teammanager ist.
  // Dort antwortet die Lizenzuebersicht mit 403, und der ErrorInterceptor
  // leitete auf die Startseite um. Massgeblich ist das Flag der API, nicht
  // `club_ids` im localStorage, der nach einem Rollenentzug alt steht.
  it('fragt die Lizenzzahlen nur fuer Vereine ab, die die API freigibt', () => {
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

    const req = http.expectOne(
      `${environment.apiURL}vm/clubs/113/license_summary.json`
    );
    expect(req.request.method).toBe('GET');
    http.expectNone(`${environment.apiURL}vm/clubs/114/license_summary.json`);
  });
});
