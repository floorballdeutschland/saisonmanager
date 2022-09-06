import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LicenseTeamDetailComponent } from './license-team-detail.component';

describe('LicenseTeamDetailComponent', () => {
  let component: LicenseTeamDetailComponent;
  let fixture: ComponentFixture<LicenseTeamDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LicenseTeamDetailComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LicenseTeamDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
