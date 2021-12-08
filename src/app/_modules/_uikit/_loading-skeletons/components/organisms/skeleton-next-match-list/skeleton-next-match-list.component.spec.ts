import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SkeletonNextMatchListComponent } from './skeleton-next-match-list.component';

describe('SkeletonNextMatchListComponent', () => {
  let component: SkeletonNextMatchListComponent;
  let fixture: ComponentFixture<SkeletonNextMatchListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SkeletonNextMatchListComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SkeletonNextMatchListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
