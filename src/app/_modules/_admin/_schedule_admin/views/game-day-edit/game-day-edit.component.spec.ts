import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { GameDayEditComponent } from './game-day-edit.component';

describe('GameDayEditComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [GameDayEditComponent],
    })
      .overrideTemplate(GameDayEditComponent, '')
      .compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(GameDayEditComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
