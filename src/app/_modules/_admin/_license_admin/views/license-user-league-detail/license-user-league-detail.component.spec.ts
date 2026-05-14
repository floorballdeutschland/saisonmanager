import { TestBed } from '@angular/core/testing';

import { LicenseUserLeagueDetailComponent } from './license-user-league-detail.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

describe('LicenseUserLeagueDetailComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [LicenseUserLeagueDetailComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(LicenseUserLeagueDetailComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
