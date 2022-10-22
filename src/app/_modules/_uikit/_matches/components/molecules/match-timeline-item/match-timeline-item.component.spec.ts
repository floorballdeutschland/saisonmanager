import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MatchTimelineItemComponent } from './match-timeline-item.component';

describe('MatchTimelineItemComponent', () => {
  let component: MatchTimelineItemComponent;
  let fixture: ComponentFixture<MatchTimelineItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
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
