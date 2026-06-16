import { getTranslocoTestingModule } from '@floorball/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImportGameDaysComponent } from './import-game-days.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('ImportGameDaysComponent', () => {
  let component: ImportGameDaysComponent;
  let fixture: ComponentFixture<ImportGameDaysComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [getTranslocoTestingModule(), HttpClientTestingModule],
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
