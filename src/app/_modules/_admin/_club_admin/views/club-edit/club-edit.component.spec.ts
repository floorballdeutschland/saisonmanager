import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClubEditComponent } from './club-edit.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('ClubEditComponent', () => {
  let component: ClubEditComponent;
  let fixture: ComponentFixture<ClubEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [ClubEditComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ClubEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
