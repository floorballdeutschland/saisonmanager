import { TestBed } from '@angular/core/testing';

import { MatchTimelineItemComponent } from './match-timeline-item.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

describe('MatchTimelineItemComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [MatchTimelineItemComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(MatchTimelineItemComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
