import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MetanavigationComponent } from './metanavigation.component';

describe('MetanavigationComponent', () => {
  let component: MetanavigationComponent;
  let fixture: ComponentFixture<MetanavigationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MetanavigationComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MetanavigationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
