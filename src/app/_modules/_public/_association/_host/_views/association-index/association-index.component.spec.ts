import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssociationIndexComponent } from './association-index.component';

describe('AssociationIndexComponent', () => {
  let component: AssociationIndexComponent;
  let fixture: ComponentFixture<AssociationIndexComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AssociationIndexComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AssociationIndexComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
