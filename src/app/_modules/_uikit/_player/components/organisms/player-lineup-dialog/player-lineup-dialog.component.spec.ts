import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlayerLineupDialogComponent } from './player-lineup-dialog.component';

describe('TeamSquadComponent', () => {
  let component: PlayerLineupDialogComponent;
  let fixture: ComponentFixture<PlayerLineupDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PlayerLineupDialogComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PlayerLineupDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
