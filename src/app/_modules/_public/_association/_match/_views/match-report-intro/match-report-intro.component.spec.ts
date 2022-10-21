import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MatchReportIntroComponent } from './match-report-intro.component';

describe('MatchReportIntroComponent', () => {
  let component: MatchReportIntroComponent;
  let fixture: ComponentFixture<MatchReportIntroComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MatchReportIntroComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MatchReportIntroComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
