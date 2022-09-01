import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameDayEditComponent } from './game-day-edit.component';

describe('HomeComponent', () => {
  let component: GameDayEditComponent;
  let fixture: ComponentFixture<GameDayEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GameDayEditComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GameDayEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
