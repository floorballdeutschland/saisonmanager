import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WhistleIconComponent } from './whistle-icon.component';

describe('WhistleIconComponent', () => {
  let component: WhistleIconComponent;
  let fixture: ComponentFixture<WhistleIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [WhistleIconComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(WhistleIconComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
