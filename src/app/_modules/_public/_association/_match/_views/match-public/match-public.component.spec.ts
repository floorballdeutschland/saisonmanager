import { TestBed } from '@angular/core/testing';

import { MatchPublicComponent } from './match-public.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

describe('MatchPublicComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [MatchPublicComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(MatchPublicComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
