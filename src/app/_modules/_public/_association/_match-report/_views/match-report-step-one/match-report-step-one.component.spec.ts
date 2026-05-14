import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MatchReportStepOneComponent } from './match-report-step-one.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('MatchReportStepOneComponent', () => {
  let component: MatchReportStepOneComponent;
  let fixture: ComponentFixture<MatchReportStepOneComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [MatchReportStepOneComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MatchReportStepOneComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
