import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MatchEncounterComponent } from './match-encounter.component';

describe('MatchEncounterComponent', () => {
  let component: MatchEncounterComponent;
  let fixture: ComponentFixture<MatchEncounterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MatchEncounterComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MatchEncounterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
