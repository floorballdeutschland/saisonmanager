import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RankingComponent } from './ranking.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('RankingComponent', () => {
  let component: RankingComponent;
  let fixture: ComponentFixture<RankingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [RankingComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RankingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
