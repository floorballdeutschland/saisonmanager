import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeamLineupComponent } from './team-lineup.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('TeamLineupComponent', () => {
  let component: TeamLineupComponent;
  let fixture: ComponentFixture<TeamLineupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [TeamLineupComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TeamLineupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
