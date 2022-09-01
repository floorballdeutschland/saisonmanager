import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScheduleIndexComponent } from './schedule-index.component';

describe('HomeComponent', () => {
  let component: ScheduleIndexComponent;
  let fixture: ComponentFixture<ScheduleIndexComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ScheduleIndexComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ScheduleIndexComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
