import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MatchDayComponent } from './match-day.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('MatchDayComponent', () => {
  let component: MatchDayComponent;
  let fixture: ComponentFixture<MatchDayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [MatchDayComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MatchDayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
