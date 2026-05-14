import { TestBed } from '@angular/core/testing';

import { TeamStartingPlayersComponent } from './team-starting-players.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

describe('TeamStartingPlayersComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [TeamStartingPlayersComponent],
    })
      .overrideTemplate(TeamStartingPlayersComponent, '')
      .compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(TeamStartingPlayersComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
