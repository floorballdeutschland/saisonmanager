import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LicenseClubIndexComponent } from './license-club-index.component';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { getTranslocoTestingModule, SessionService } from '@floorball/core';
import { of } from 'rxjs';
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
      providers: [
        // VM von 113, nicht von 114 (dort nur Teammanager).
        {
          provide: SessionService,
          useValue: { currentUser$: of({ club_ids: [113] }) },
        },
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

  // Die Liste enthaelt auch Vereine, in denen das Konto nur Teammanager ist.
  // Dort antwortet die Lizenzuebersicht mit 403, und der ErrorInterceptor
  // leitete um.
  it('fragt die Lizenzzahlen nur fuer Vereine ab, in denen das Konto VM ist', () => {
    http.expectOne(`${environment.apiURL}vm/clubs_and_teams.json`).flush([
      { id: 113, name: 'TSV Rohrdorf-Thansau', teams: [] },
      { id: 114, name: 'Fremdverein', teams: [] },
    ]);
    fixture.detectChanges();

    http.expectOne(`${environment.apiURL}vm/clubs/113/license_summary.json`);
    http.expectNone(`${environment.apiURL}vm/clubs/114/license_summary.json`);
  });
});
