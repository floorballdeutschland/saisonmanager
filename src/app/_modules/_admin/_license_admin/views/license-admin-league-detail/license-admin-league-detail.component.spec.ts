import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LicenseAdminLeagueDetailComponent } from './license-admin-league-detail.component';

describe('LicenseAdminLeagueDetailComponent', () => {
  let component: LicenseAdminLeagueDetailComponent;
  let fixture: ComponentFixture<LicenseAdminLeagueDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LicenseAdminLeagueDetailComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LicenseAdminLeagueDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
