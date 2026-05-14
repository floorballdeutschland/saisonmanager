import { TestBed } from '@angular/core/testing';

import { MatchEncounterComponent } from './match-encounter.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

describe('MatchEncounterComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [MatchEncounterComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(MatchEncounterComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
