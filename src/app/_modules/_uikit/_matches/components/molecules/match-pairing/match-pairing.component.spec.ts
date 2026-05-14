import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MatchPairingComponent } from './match-pairing.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('MatchPairingComponent', () => {
  let component: MatchPairingComponent;
  let fixture: ComponentFixture<MatchPairingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [MatchPairingComponent],
    }).compileComponents();
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
