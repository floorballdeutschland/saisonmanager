import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScorerComponent } from './scorer.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('ScorerComponent', () => {
  let component: ScorerComponent;
  let fixture: ComponentFixture<ScorerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [ScorerComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ScorerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
