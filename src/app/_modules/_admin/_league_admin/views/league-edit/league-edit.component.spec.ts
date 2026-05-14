import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { LeagueEditComponent } from './league-edit.component';

describe('LeagueEditComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [LeagueEditComponent],
    })
      .overrideTemplate(LeagueEditComponent, '')
      .compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(LeagueEditComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
