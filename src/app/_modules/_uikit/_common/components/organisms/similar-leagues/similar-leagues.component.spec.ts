import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SimilarLeaguesComponent } from './similar-leagues.component';

describe('SimilarLeaguesComponent', () => {
  let component: SimilarLeaguesComponent;
  let fixture: ComponentFixture<SimilarLeaguesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SimilarLeaguesComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SimilarLeaguesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
