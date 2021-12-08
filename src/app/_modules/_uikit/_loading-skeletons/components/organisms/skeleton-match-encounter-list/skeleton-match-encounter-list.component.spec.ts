import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SkeletonMatchEncounterListComponent } from './skeleton-match-encounter-list.component';

describe('SkeletonMatchEncounterListComponent', () => {
  let component: SkeletonMatchEncounterListComponent;
  let fixture: ComponentFixture<SkeletonMatchEncounterListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SkeletonMatchEncounterListComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SkeletonMatchEncounterListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
