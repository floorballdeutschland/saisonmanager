import { TestBed } from '@angular/core/testing';

import { AssociationHostComponent } from './association-host.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

describe('AssociationHostComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [AssociationHostComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(AssociationHostComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
