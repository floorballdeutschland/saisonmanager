import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeamIndexComponent } from './team-index.component';

describe('HomeComponent', () => {
  let component: TeamIndexComponent;
  let fixture: ComponentFixture<TeamIndexComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TeamIndexComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TeamIndexComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
