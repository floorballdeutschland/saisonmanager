import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeamSquadComponent } from './team-squad.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('TeamSquadComponent', () => {
  let component: TeamSquadComponent;
  let fixture: ComponentFixture<TeamSquadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [TeamSquadComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TeamSquadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
