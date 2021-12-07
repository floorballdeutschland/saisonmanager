import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MatchesWithRoundsComponent } from './matches-with-rounds.component';

describe('MatchesWithRoundsComponent', () => {
  let component: MatchesWithRoundsComponent;
  let fixture: ComponentFixture<MatchesWithRoundsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MatchesWithRoundsComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MatchesWithRoundsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
