import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NextMatchItemComponent } from './next-match-item.component';

describe('NextMatchItemComponent', () => {
  let component: NextMatchItemComponent;
  let fixture: ComponentFixture<NextMatchItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ NextMatchItemComponent ]
    })
    .compileComponents();
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
