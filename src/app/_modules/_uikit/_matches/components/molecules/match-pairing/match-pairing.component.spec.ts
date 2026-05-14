import { TestBed } from '@angular/core/testing';

import { MatchPairingComponent } from './match-pairing.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

describe('MatchPairingComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [MatchPairingComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(MatchPairingComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
