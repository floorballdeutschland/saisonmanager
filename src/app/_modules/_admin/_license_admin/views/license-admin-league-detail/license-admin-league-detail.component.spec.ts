import { TestBed } from '@angular/core/testing';

import { LicenseAdminLeagueDetailComponent } from './license-admin-league-detail.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { getTranslocoTestingModule } from '@floorball/core';

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
});
