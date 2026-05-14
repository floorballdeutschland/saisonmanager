import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ScheduleIndexComponent } from './schedule-index.component';

describe('ScheduleIndexComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [ScheduleIndexComponent],
    })
      .overrideTemplate(ScheduleIndexComponent, '')
      .compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ScheduleIndexComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
