import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LostPasswordComponent } from './lost-password.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('LostPasswordComponent', () => {
  let component: LostPasswordComponent;
  let fixture: ComponentFixture<LostPasswordComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [LostPasswordComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LostPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
