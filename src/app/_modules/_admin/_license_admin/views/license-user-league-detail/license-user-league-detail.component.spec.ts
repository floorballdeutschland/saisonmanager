import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LicenseUserLeagueDetailComponent } from './license-user-league-detail.component';

describe('LicenseUserLeagueDetailComponent', () => {
  let component: LicenseUserLeagueDetailComponent;
  let fixture: ComponentFixture<LicenseUserLeagueDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LicenseUserLeagueDetailComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LicenseUserLeagueDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
