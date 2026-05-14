import { TestBed } from '@angular/core/testing';

import { TeamSquadComponent } from './team-squad.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

describe('TeamSquadComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [TeamSquadComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(TeamSquadComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
