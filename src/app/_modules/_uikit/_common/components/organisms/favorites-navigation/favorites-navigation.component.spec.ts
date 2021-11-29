import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FavoritesNavigationComponent } from './favorites-navigation.component';

describe('FavoritesNavigationComponent', () => {
  let component: FavoritesNavigationComponent;
  let fixture: ComponentFixture<FavoritesNavigationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FavoritesNavigationComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(FavoritesNavigationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
