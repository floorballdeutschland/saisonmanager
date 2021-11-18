import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeamRankingTableComponent } from './team-ranking-table.component';

describe('TeamRankingTableComponent', () => {
  let component: TeamRankingTableComponent;
  let fixture: ComponentFixture<TeamRankingTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TeamRankingTableComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TeamRankingTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
