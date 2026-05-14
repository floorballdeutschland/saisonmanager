import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MatchHistoryComponent } from './match-history.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('MatchHistoryComponent', () => {
  let component: MatchHistoryComponent;
  let fixture: ComponentFixture<MatchHistoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [MatchHistoryComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MatchHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
