import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlayerRankingTableComponent } from './player-ranking-table.component';

describe('PlayerRankingTableComponent', () => {
  let component: PlayerRankingTableComponent;
  let fixture: ComponentFixture<PlayerRankingTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PlayerRankingTableComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PlayerRankingTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
