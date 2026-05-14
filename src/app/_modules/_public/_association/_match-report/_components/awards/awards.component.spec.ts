import { TestBed } from '@angular/core/testing';

import { AwardsComponent } from './awards.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

describe('AwardsComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [AwardsComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(AwardsComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
