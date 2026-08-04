import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LicenseClubIndexComponent } from './license-club-index.component';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { getTranslocoTestingModule } from '@floorball/core';
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
      declarations: [LicenseClubIndexComponent],
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
});
