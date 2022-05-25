import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeamSquadHistoryComponent } from './team-squad-history.component';

describe('TeamSquadHistoryComponent', () => {
  let component: TeamSquadHistoryComponent;
  let fixture: ComponentFixture<TeamSquadHistoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TeamSquadHistoryComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TeamSquadHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
