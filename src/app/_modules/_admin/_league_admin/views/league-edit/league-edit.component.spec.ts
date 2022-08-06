import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeagueEditComponent } from './league-edit.component';

describe('HomeComponent', () => {
  let component: LeagueEditComponent;
  let fixture: ComponentFixture<LeagueEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LeagueEditComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LeagueEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
