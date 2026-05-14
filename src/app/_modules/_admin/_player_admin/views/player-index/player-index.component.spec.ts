import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlayerIndexComponent } from './player-index.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('PlayerIndexComponent', () => {
  let component: PlayerIndexComponent;
  let fixture: ComponentFixture<PlayerIndexComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [PlayerIndexComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PlayerIndexComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
