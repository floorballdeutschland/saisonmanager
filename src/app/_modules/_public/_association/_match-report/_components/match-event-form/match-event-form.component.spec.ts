import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MatchEventFormComponent } from './match-event-form.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('MatchEventFormComponent', () => {
  let component: MatchEventFormComponent;
  let fixture: ComponentFixture<MatchEventFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [MatchEventFormComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MatchEventFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
