import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TableEntry } from '@floorball/models';
import { TeamRankingTableComponent } from './team-ranking-table.component';

describe('TeamRankingTableComponent', () => {
  let component: TeamRankingTableComponent;
  let fixture: ComponentFixture<TeamRankingTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TeamRankingTableComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TeamRankingTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Vorrundenwerte', () => {
    const row = (name: string, extra: Partial<TableEntry> = {}) =>
      ({
        team_name: name,
        point_corrections: null,
        ...extra,
      }) as unknown as TableEntry;

    it('nennt je Mannschaft die uebernommenen Werte in der Fussnote', () => {
      fixture.componentRef.setInput('data', [
        row('Verein A', {
          preround: { points: 3, goals_scored: 4, goals_received: 1 },
        }),
        row('Verein B'),
      ]);
      fixture.detectChanges();

      const note = fixture.nativeElement.querySelector(
        '[data-testid="preround-transfers"]'
      ) as HTMLElement;
      expect(note.textContent).toContain('Verein A: 3 Punkte, Tore 4:1');
      expect(note.textContent).not.toContain('Verein B');
    });

    it('zeigt ohne uebernommene Werte keine Fussnote', () => {
      fixture.componentRef.setInput('data', [row('Verein A')]);
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="preround-transfers"]'
        )
      ).toBeNull();
    });

    it('beschreibt die komplette Bilanz', () => {
      expect(
        TeamRankingTableComponent.describePreround({
          points: 1,
          games: 2,
          won: 0,
          draw: 1,
          lost: 1,
          won_ot: 0,
          lost_ot: 0,
          goals_scored: 2,
          goals_received: 3,
        })
      ).toBe('1 Punkt, 2 Spiele (0 S, 1 U, 1 N), Tore 2:3');
    });
  });
});
