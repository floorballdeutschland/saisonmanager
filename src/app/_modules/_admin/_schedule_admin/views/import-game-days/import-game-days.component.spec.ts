import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImportGameDaysComponent } from './import-game-days.component';

describe('ImportGameDaysComponent', () => {
  let component: ImportGameDaysComponent;
  let fixture: ComponentFixture<ImportGameDaysComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ImportGameDaysComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ImportGameDaysComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
