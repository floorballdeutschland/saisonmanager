import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LicenseUserLeagueDetailComponent } from './license-user-league-detail.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('LicenseUserLeagueDetailComponent', () => {
  let component: LicenseUserLeagueDetailComponent;
  let fixture: ComponentFixture<LicenseUserLeagueDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
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
