import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { getTranslocoTestingModule } from '@floorball/core';
import { ProceedingProposalIndexComponent } from './proceeding-proposal-index.component';

describe('ProceedingProposalIndexComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [ProceedingProposalIndexComponent],
    })
      .overrideTemplate(ProceedingProposalIndexComponent, '')
      .compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ProceedingProposalIndexComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
