import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MatchHistoryItemComponent } from './match-history-item.component';

describe('MatchHistoryItemComponent', () => {
  let component: MatchHistoryItemComponent;
  let fixture: ComponentFixture<MatchHistoryItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MatchHistoryItemComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MatchHistoryItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
