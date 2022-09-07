import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LicenseClubIndexComponent } from './license-club-index.component';

describe('LicenseClubIndexComponent', () => {
  let component: LicenseClubIndexComponent;
  let fixture: ComponentFixture<LicenseClubIndexComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LicenseClubIndexComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LicenseClubIndexComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
