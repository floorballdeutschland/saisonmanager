import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MatchPairingComponent } from './match-pairing.component';

describe('MatchPairingComponent', () => {
  let component: MatchPairingComponent;
  let fixture: ComponentFixture<MatchPairingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MatchPairingComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MatchPairingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
