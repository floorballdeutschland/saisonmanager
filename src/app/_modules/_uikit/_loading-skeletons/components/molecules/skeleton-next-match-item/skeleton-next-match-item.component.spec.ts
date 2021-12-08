import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SkeletonNextMatchItemComponent } from './skeleton-next-match-item.component';

describe('SkeletonNextMatchItemComponent', () => {
  let component: SkeletonNextMatchItemComponent;
  let fixture: ComponentFixture<SkeletonNextMatchItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SkeletonNextMatchItemComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SkeletonNextMatchItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
