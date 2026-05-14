import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MatchReportComponent } from './match-report.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('MatchReportComponent', () => {
  let component: MatchReportComponent;
  let fixture: ComponentFixture<MatchReportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [MatchReportComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MatchReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
