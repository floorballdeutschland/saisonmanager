import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NextMatchListComponent } from './next-match-list.component';

describe('NextMatchListComponent', () => {
  let component: NextMatchListComponent;
  let fixture: ComponentFixture<NextMatchListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ NextMatchListComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NextMatchListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
