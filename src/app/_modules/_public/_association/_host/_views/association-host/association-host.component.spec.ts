import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssociationHostComponent } from './association-host.component';

describe('AssociationHostComponent', () => {
  let component: AssociationHostComponent;
  let fixture: ComponentFixture<AssociationHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AssociationHostComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AssociationHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
