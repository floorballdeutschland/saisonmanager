import { TestBed } from '@angular/core/testing';

import { OperationComponent } from './operation.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

describe('OperationComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [OperationComponent],
    })
      .overrideTemplate(OperationComponent, '')
      .compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(OperationComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
