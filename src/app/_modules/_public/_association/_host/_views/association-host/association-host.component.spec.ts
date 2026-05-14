import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssociationHostComponent } from './association-host.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('AssociationHostComponent', () => {
  let component: AssociationHostComponent;
  let fixture: ComponentFixture<AssociationHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
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
