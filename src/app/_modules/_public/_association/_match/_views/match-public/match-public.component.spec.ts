import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MatchPublicComponent } from './match-public.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('MatchPublicComponent', () => {
  let component: MatchPublicComponent;
  let fixture: ComponentFixture<MatchPublicComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [MatchPublicComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MatchPublicComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
