import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeamSquadPlayerComponent } from './team-squad-player.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('TeamSquadPlayerComponent', () => {
  let component: TeamSquadPlayerComponent;
  let fixture: ComponentFixture<TeamSquadPlayerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [TeamSquadPlayerComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TeamSquadPlayerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
