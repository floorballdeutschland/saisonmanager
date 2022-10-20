import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeagueNavigationComponent } from './league-navigation.component';

describe('LeagueNavigationComponent', () => {
  let component: LeagueNavigationComponent;
  let fixture: ComponentFixture<LeagueNavigationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LeagueNavigationComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LeagueNavigationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
