import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AwardsComponent } from './awards.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('AwardsComponent', () => {
  let component: AwardsComponent;
  let fixture: ComponentFixture<AwardsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [AwardsComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AwardsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
