import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NextMatchItemComponent } from './next-match-item.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('NextMatchItemComponent', () => {
  let component: NextMatchItemComponent;
  let fixture: ComponentFixture<NextMatchItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [NextMatchItemComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NextMatchItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
