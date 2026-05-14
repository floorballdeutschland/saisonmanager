import { TestBed } from '@angular/core/testing';

import { MatchDayComponent } from './match-day.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

describe('MatchDayComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [MatchDayComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(MatchDayComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
