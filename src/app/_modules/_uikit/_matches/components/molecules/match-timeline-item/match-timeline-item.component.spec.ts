import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MatchTimelineItemComponent } from './match-timeline-item.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('MatchTimelineItemComponent', () => {
  let component: MatchTimelineItemComponent;
  let fixture: ComponentFixture<MatchTimelineItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [MatchTimelineItemComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MatchTimelineItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
