import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { GameScheduleEntry } from '@floorball/types';

import { TournamentMatchesFinalComponent } from './tournament-matches-final.component';

const entry = (partial: Partial<GameScheduleEntry>): GameScheduleEntry =>
  partial as GameScheduleEntry;

describe('TournamentMatchesFinalComponent', () => {
  let component: TournamentMatchesFinalComponent;
  let fixture: ComponentFixture<TournamentMatchesFinalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TournamentMatchesFinalComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TournamentMatchesFinalComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('zeigt nur Spiele ohne group_identifier, gruppiert nach series_title', () => {
    component.matches$ = of([
      entry({ game_id: 1, group_identifier: 'group_a', series_title: null }),
      entry({ game_id: 2, group_identifier: null, series_title: 'Halbfinale' }),
      entry({ game_id: 3, group_identifier: null, series_title: 'Halbfinale' }),
      entry({
        game_id: 4,
        group_identifier: null,
        series_title: 'Spiel um Platz 3',
      }),
      entry({ game_id: 5, group_identifier: null, series_title: 'Finale' }),
    ]);

    fixture.detectChanges();

    expect(component.loaded).toBeTrue();
    expect(component.groupedMatches.length).toBe(3);
    expect(component.groupedMatches[0].round_title).toBe('Halbfinale');
    expect(component.groupedMatches[0].matches.map((m) => m.game_id)).toEqual([
      2, 3,
    ]);
    expect(component.groupedMatches[1].round_title).toBe('Spiel um Platz 3');
    expect(component.groupedMatches[2].round_title).toBe('Finale');
  });

  it('liefert eine leere Liste, wenn alle Spiele einer Gruppe zugeordnet sind', () => {
    component.matches$ = of([
      entry({ game_id: 1, group_identifier: 'group_a' }),
      entry({ game_id: 2, group_identifier: 'group_b' }),
    ]);

    fixture.detectChanges();

    expect(component.loaded).toBeTrue();
    expect(component.groupedMatches).toEqual([]);
  });
});
