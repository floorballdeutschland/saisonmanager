import { TestBed } from '@angular/core/testing';

import { LostPasswordComponent } from './lost-password.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

describe('LostPasswordComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [LostPasswordComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(LostPasswordComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
