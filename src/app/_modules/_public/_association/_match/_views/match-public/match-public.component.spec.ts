import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MatchPublicComponent } from './match-public.component';

describe('MatchPublicComponent', () => {
  let component: MatchPublicComponent;
  let fixture: ComponentFixture<MatchPublicComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
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
