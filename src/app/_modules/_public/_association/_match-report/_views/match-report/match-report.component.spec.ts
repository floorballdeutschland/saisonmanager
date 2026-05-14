import { TestBed } from '@angular/core/testing';

import { MatchReportComponent } from './match-report.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

describe('MatchReportComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [MatchReportComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(MatchReportComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
