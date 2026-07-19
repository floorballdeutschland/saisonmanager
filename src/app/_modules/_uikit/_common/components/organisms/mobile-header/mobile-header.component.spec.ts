import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MobileHeaderComponent } from './mobile-header.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { LeagueService } from '@floorball/core';

describe('MobileHeaderComponent', () => {
  let component: MobileHeaderComponent;
  let fixture: ComponentFixture<MobileHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [MobileHeaderComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MobileHeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Regressionsschutz zu #103: Der Switcher muss über changeSeason gehen,
  // nicht direkt über AssociationService.selectSeason.
  it('onSeasonChange delegiert an LeagueService.changeSeason', () => {
    const changeSeason = spyOn(TestBed.inject(LeagueService), 'changeSeason');

    component.onSeasonChange({
      target: { value: '12' },
    } as unknown as Event);

    expect(changeSeason).toHaveBeenCalledWith(12);
  });
});
