import { TestBed } from '@angular/core/testing';

import { TabItemComponent } from './tab-item.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

describe('TabItemComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [TabItemComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(TabItemComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
