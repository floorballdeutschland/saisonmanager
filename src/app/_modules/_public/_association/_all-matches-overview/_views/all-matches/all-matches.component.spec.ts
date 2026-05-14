import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AllMatchesComponent } from './all-matches.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('AllMatchesComponent', () => {
  let component: AllMatchesComponent;
  let fixture: ComponentFixture<AllMatchesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [AllMatchesComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AllMatchesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
