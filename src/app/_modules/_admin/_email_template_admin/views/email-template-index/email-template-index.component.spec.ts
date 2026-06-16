import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { getTranslocoTestingModule } from '@floorball/core';
import { EmailTemplateIndexComponent } from './email-template-index.component';

describe('EmailTemplateIndexComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [EmailTemplateIndexComponent],
    })
      .overrideTemplate(EmailTemplateIndexComponent, '')
      .compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(EmailTemplateIndexComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
