import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeamComponent } from './team.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { TeamStats } from '@floorball/types';

describe('TeamComponent', () => {
  let component: TeamComponent;
  let fixture: ComponentFixture<TeamComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [TeamComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TeamComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('scorerListVisible', () => {
    it('should hide the scorer list when the league hides it', () => {
      component.stats = { scorer_visible: false } as TeamStats;

      expect(component.scorerListVisible()).toBeFalse();
    });

    it('should show the scorer list when the league shows it', () => {
      component.stats = { scorer_visible: true } as TeamStats;

      expect(component.scorerListVisible()).toBeTrue();
    });

    it('should show the scorer list when the API omits the flag', () => {
      // Älteres API ohne scorer_visible: Verhalten bleibt wie bisher.
      component.stats = {} as TeamStats;

      expect(component.scorerListVisible()).toBeTrue();
    });
  });
});
