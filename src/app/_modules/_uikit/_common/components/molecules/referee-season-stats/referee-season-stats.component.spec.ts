import { ComponentFixture, TestBed } from '@angular/core/testing';
import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';

import { RefereeSeasonStatsComponent } from './referee-season-stats.component';

describe('RefereeSeasonStatsComponent', () => {
  let fixture: ComponentFixture<RefereeSeasonStatsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        getTranslocoTestingModule({
          de: { refereeSeasonStats: { current: '(laufend)' } },
        }),
      ],
      declarations: [RefereeSeasonStatsComponent],
    });
    fixture = TestBed.createComponent(RefereeSeasonStatsComponent);
  });

  it('zeigt je Saison beide Zahlen und markiert die laufende', () => {
    fixture.componentRef.setInput('stats', [
      {
        season_id: 18,
        season_name: '2026/2027',
        current: true,
        games: 12,
        games_gf_u15_plus: 8,
      },
      {
        season_id: 17,
        season_name: '2025/2026',
        current: false,
        games: 20,
        games_gf_u15_plus: 15,
      },
    ]);
    fixture.detectChanges();

    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll(
      'tbody tr'
    );
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('2026/2027');
    expect(rows[0].textContent).toContain('(laufend)');
    expect(rows[0].textContent).toContain('12');
    expect(rows[0].textContent).toContain('8');
    expect(rows[1].textContent).not.toContain('(laufend)');
    expect(rows[1].textContent).toContain('15');
  });
});
