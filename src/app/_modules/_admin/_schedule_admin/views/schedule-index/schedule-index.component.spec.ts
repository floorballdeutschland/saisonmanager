import { getTranslocoTestingModule } from '@floorball/core';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ScheduleIndexComponent } from './schedule-index.component';

describe('ScheduleIndexComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        getTranslocoTestingModule(),
        HttpClientTestingModule,
        RouterTestingModule,
      ],
      declarations: [ScheduleIndexComponent],
    })
      .overrideTemplate(ScheduleIndexComponent, '')
      .compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ScheduleIndexComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('exportUrl zeigt auf die gerade geöffnete Liga', () => {
    const fixture = TestBed.createComponent(ScheduleIndexComponent);
    const component = fixture.componentInstance;
    component.leagueId = 944;

    expect(component.exportUrl('xlsx')).toContain(
      'admin/leagues/944/schedule_export.xlsx'
    );
    expect(component.exportUrl('csv')).toContain(
      'admin/leagues/944/schedule_export.csv'
    );
  });
});
