import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TournamentMatchesGroupComponent } from './tournament-matches-group.component';

describe('TournamentMatchesGroupComponent', () => {
  let component: TournamentMatchesGroupComponent;
  let fixture: ComponentFixture<TournamentMatchesGroupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TournamentMatchesGroupComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TournamentMatchesGroupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
