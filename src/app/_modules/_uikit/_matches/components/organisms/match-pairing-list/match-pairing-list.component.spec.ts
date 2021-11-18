import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MatchPairingListComponent } from './match-pairing-list.component';

describe('MatchPairingListComponent', () => {
  let component: MatchPairingListComponent;
  let fixture: ComponentFixture<MatchPairingListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MatchPairingListComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MatchPairingListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
