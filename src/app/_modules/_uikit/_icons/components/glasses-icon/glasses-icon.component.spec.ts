import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GlassesIconComponent } from './glasses-icon.component';

describe('GlassesIconComponent', () => {
  let component: GlassesIconComponent;
  let fixture: ComponentFixture<GlassesIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GlassesIconComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GlassesIconComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
