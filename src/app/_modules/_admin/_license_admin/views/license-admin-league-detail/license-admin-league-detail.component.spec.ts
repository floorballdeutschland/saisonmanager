import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LicenseAdminLeagueDetailComponent } from './license-admin-league-detail.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('LicenseAdminLeagueDetailComponent', () => {
  let component: LicenseAdminLeagueDetailComponent;
  let fixture: ComponentFixture<LicenseAdminLeagueDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
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
