import { TestBed } from '@angular/core/testing';

import { AllMatchesComponent } from './all-matches.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

describe('AllMatchesComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [AllMatchesComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(AllMatchesComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
