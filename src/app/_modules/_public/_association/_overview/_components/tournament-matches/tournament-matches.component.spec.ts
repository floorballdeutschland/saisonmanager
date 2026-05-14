import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TournamentMatchesComponent } from './tournament-matches.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('TournamentMatchesComponent', () => {
  let component: TournamentMatchesComponent;
  let fixture: ComponentFixture<TournamentMatchesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [TournamentMatchesComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TournamentMatchesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
