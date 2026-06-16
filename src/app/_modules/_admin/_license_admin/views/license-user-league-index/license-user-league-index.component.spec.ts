import { TestBed } from '@angular/core/testing';

import { LicenseUserLeagueIndexComponent } from './license-user-league-index.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { getTranslocoTestingModule } from '@floorball/core';

describe('LicenseUserLeagueIndexComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [LicenseUserLeagueIndexComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(LicenseUserLeagueIndexComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
