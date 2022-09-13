import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MatchEventButtonComponent } from './match-event-button.component';

describe('MatchEventButtonComponent', () => {
  let component: MatchEventButtonComponent;
  let fixture: ComponentFixture<MatchEventButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MatchEventButtonComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MatchEventButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
