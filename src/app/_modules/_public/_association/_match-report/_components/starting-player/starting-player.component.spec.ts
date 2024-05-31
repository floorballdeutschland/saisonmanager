import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StartingPlayerComponent } from './starting-player.component';

describe('StartingPlayerComponent', () => {
  let component: StartingPlayerComponent;
  let fixture: ComponentFixture<StartingPlayerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StartingPlayerComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(StartingPlayerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
