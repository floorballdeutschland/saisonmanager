import { TestBed } from '@angular/core/testing';

import { LeagueHostComponent } from './league-host.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

describe('LeagueHostComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [LeagueHostComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(LeagueHostComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
