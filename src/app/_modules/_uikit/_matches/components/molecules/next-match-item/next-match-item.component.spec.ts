import { TestBed } from '@angular/core/testing';

import { NextMatchItemComponent } from './next-match-item.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

describe('NextMatchItemComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [NextMatchItemComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(NextMatchItemComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
