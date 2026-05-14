import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClubIndexComponent } from './club-index.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('ClubIndexComponent', () => {
  let component: ClubIndexComponent;
  let fixture: ComponentFixture<ClubIndexComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [ClubIndexComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ClubIndexComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
