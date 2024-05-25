import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeamStartingPlayersComponent } from './team-starting-players.component';

describe('TeamStartingPlayersComponent', () => {
  let component: TeamStartingPlayersComponent;
  let fixture: ComponentFixture<TeamStartingPlayersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TeamStartingPlayersComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TeamStartingPlayersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
