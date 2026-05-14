import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeamRankingTableOverlayComponent } from './team-ranking-table-overlay.component';

describe('TeamRankingTableOverlayComponent', () => {
  let component: TeamRankingTableOverlayComponent;
  let fixture: ComponentFixture<TeamRankingTableOverlayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TeamRankingTableOverlayComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TeamRankingTableOverlayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
