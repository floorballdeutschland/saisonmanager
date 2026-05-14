import { TestBed } from '@angular/core/testing';

import { MatchReportStepOneComponent } from './match-report-step-one.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

describe('MatchReportStepOneComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [MatchReportStepOneComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(MatchReportStepOneComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
