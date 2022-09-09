import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LicenseAdminDetailComponent } from './license-admin-detail.component';

describe('LicenseAdminDetailComponent', () => {
  let component: LicenseAdminDetailComponent;
  let fixture: ComponentFixture<LicenseAdminDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LicenseAdminDetailComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LicenseAdminDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
