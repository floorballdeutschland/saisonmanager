import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeamStartingPlayersComponent } from './team-starting-players.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('TeamStartingPlayersComponent', () => {
  let component: TeamStartingPlayersComponent;
  let fixture: ComponentFixture<TeamStartingPlayersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
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
