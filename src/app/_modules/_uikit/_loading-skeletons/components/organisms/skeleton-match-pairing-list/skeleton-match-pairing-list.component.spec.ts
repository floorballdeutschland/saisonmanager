import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SkeletonMatchPairingListComponent } from './skeleton-match-pairing-list.component';

describe('SkeletonMatchPairingListComponent', () => {
  let component: SkeletonMatchPairingListComponent;
  let fixture: ComponentFixture<SkeletonMatchPairingListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SkeletonMatchPairingListComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SkeletonMatchPairingListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
