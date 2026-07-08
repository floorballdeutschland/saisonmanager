import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { getTranslocoTestingModule } from '@floorball/core';
import { DocumentTypeIndexComponent } from './document-type-index.component';

describe('DocumentTypeIndexComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [DocumentTypeIndexComponent],
    })
      .overrideTemplate(DocumentTypeIndexComponent, '')
      .compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(DocumentTypeIndexComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
