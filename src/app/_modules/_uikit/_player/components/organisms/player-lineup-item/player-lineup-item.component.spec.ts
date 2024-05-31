import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlayerLineupItemComponent } from './player-lineup-item.component';

describe('PlayerLineupItemComponent', () => {
  let component: PlayerLineupItemComponent;
  let fixture: ComponentFixture<PlayerLineupItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PlayerLineupItemComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PlayerLineupItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
