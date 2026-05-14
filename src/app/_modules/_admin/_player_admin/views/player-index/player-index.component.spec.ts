import { TestBed } from '@angular/core/testing';

import { PlayerIndexComponent } from './player-index.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

describe('PlayerIndexComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [PlayerIndexComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(PlayerIndexComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
