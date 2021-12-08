import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SkeletonMatchPairingComponent } from './skeleton-match-pairing.component';

describe('SkeletonMatchPairingComponent', () => {
  let component: SkeletonMatchPairingComponent;
  let fixture: ComponentFixture<SkeletonMatchPairingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SkeletonMatchPairingComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SkeletonMatchPairingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
