import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TournamentMatchesFinalComponent } from './tournament-matches-final.component';

describe('TournamentMatchesFinalComponent', () => {
  let component: TournamentMatchesFinalComponent;
  let fixture: ComponentFixture<TournamentMatchesFinalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TournamentMatchesFinalComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TournamentMatchesFinalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
