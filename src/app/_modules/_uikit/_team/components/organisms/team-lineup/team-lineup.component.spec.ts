import { TestBed } from '@angular/core/testing';

import { TeamLineupComponent } from './team-lineup.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

describe('TeamLineupComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [TeamLineupComponent],
    })
      .overrideTemplate(TeamLineupComponent, '')
      .compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(TeamLineupComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
