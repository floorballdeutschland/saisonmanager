import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SkeletonMatchEncounterComponent } from './skeleton-match-encounter.component';

describe('SkeletonMatchEncounterComponent', () => {
  let component: SkeletonMatchEncounterComponent;
  let fixture: ComponentFixture<SkeletonMatchEncounterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SkeletonMatchEncounterComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SkeletonMatchEncounterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
