import { TestBed } from '@angular/core/testing';

import { StartingPlayerComponent } from './starting-player.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

describe('StartingPlayerComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [StartingPlayerComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(StartingPlayerComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
