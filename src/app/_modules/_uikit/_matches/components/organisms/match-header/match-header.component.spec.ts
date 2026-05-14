import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MatchHeaderComponent } from './match-header.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('MatchHeaderComponent', () => {
  let component: MatchHeaderComponent;
  let fixture: ComponentFixture<MatchHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [MatchHeaderComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MatchHeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
