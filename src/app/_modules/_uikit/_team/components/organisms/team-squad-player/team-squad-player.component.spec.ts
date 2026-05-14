import { TestBed } from '@angular/core/testing';

import { TeamSquadPlayerComponent } from './team-squad-player.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

describe('TeamSquadPlayerComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [TeamSquadPlayerComponent],
    })
      .overrideTemplate(TeamSquadPlayerComponent, '')
      .compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(TeamSquadPlayerComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
