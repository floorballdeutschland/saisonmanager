import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MatchComponent } from './match.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('MatchComponent', () => {
  let component: MatchComponent;
  let fixture: ComponentFixture<MatchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [MatchComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MatchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
