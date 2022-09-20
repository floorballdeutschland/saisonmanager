import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssociationNavigationComponent } from './association-navigation.component';

describe('AssociationNavigationComponent', () => {
  let component: AssociationNavigationComponent;
  let fixture: ComponentFixture<AssociationNavigationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AssociationNavigationComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AssociationNavigationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
