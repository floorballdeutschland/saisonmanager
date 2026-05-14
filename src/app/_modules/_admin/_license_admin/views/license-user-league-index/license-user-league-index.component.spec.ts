import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LicenseUserLeagueIndexComponent } from './license-user-league-index.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('LicenseUserLeagueIndexComponent', () => {
  let component: LicenseUserLeagueIndexComponent;
  let fixture: ComponentFixture<LicenseUserLeagueIndexComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [LicenseUserLeagueIndexComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LicenseUserLeagueIndexComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
