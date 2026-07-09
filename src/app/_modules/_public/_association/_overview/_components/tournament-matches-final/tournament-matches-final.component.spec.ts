import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { GameScheduleEntry } from '@floorball/types';

import { FinalRoundsPipe } from '../../../../../../_helpers/_pipes/final-rounds.pipe';
import { TournamentMatchesFinalComponent } from './tournament-matches-final.component';

const entry = (partial: Partial<GameScheduleEntry>): GameScheduleEntry =>
  partial as GameScheduleEntry;

describe('TournamentMatchesFinalComponent', () => {
  let component: TournamentMatchesFinalComponent;
  let fixture: ComponentFixture<TournamentMatchesFinalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommonModule],
      declarations: [TournamentMatchesFinalComponent, FinalRoundsPipe],
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

  it('rendert die Platzierungsrunden als Liste mit Überschriften', () => {
    component.matches$ = of([
      entry({ game_id: 1, group_identifier: 'group_a', series_title: null }),
      entry({ game_id: 2, group_identifier: null, series_title: 'Halbfinale' }),
      entry({ game_id: 3, group_identifier: null, series_title: 'Halbfinale' }),
      entry({ game_id: 4, group_identifier: null, series_title: 'Finale' }),
    ]);

    fixture.detectChanges();

    const headings = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('h3'),
    ].map((h) => h.textContent?.trim());
    expect(headings).toEqual(['Halbfinale', 'Finale']);
  });

  it('zeigt den Leer-Zustand, wenn alle Spiele einer Gruppe zugeordnet sind', () => {
    component.matches$ = of([
      entry({ game_id: 1, group_identifier: 'group_a' }),
    ]);

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Noch keine Platzierungsspiele'
    );
  });

  it('zeigt weiter das Skeleton, solange matches$ nichts geliefert hat', () => {
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('fb-skeleton-match-encounter-list')
    ).toBeTruthy();
  });
});
