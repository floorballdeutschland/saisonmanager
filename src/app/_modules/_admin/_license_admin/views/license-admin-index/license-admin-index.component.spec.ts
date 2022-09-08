import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LicenseAdminIndexComponent } from './license-admin-index.component';

describe('LicenseAdminIndexComponent', () => {
  let component: LicenseAdminIndexComponent;
  let fixture: ComponentFixture<LicenseAdminIndexComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LicenseAdminIndexComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LicenseAdminIndexComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
