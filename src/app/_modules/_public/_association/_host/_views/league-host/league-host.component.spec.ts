import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeagueHostComponent } from './league-host.component';

describe('LeagueHostComponent', () => {
  let component: LeagueHostComponent;
  let fixture: ComponentFixture<LeagueHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LeagueHostComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LeagueHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
