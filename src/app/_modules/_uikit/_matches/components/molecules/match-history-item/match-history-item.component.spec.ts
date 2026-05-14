import { TestBed } from '@angular/core/testing';

import { MatchHistoryItemComponent } from './match-history-item.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

describe('MatchHistoryItemComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [MatchHistoryItemComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(MatchHistoryItemComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
