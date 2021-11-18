import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MatchEncounterListComponent } from './match-encounter-list.component';

describe('MatchEncounterListComponent', () => {
  let component: MatchEncounterListComponent;
  let fixture: ComponentFixture<MatchEncounterListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MatchEncounterListComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MatchEncounterListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
