import { ChangeDetectorRef } from '@angular/core';
import { Game } from '@floorball/types';
import { LeagueService } from '@floorball/core';
import { MatchReportStepThreeComponent } from './match-report-step-three.component';

// Die Klasse direkt bauen statt über das TestBed: Geprüft wird die
// Voreinstellung und der Warnhinweis, und dafür braucht es die 365 Zeilen
// Template nicht.
function build(): MatchReportStepThreeComponent {
  return new MatchReportStepThreeComponent(
    {} as LeagueService,
    {
      markForCheck: () => undefined,
    } as ChangeDetectorRef
  );
}

function gameIn(leagueName: string): Game {
  return { id: 1, league_name: leagueName } as unknown as Game;
}

describe('MatchReportStepThreeComponent: Torschützennamen auf der Kachel', () => {
  // Entscheidung des Verbandes vom 13.08.2026: Auch in Jugendligen sind die
  // Namen voreingestellt an, gewarnt wird nur. Dieselbe Linie wie bei der
  // Scorerliste, wo für U13 und jünger eine Empfehlung steht und keine Sperre.
  // Der Test hält die Entscheidung fest, damit sie nicht beiläufig kippt.
  it('nennt die Namen voreingestellt, auch in einer Jugendliga', () => {
    const component = build();
    component.game = gameIn('U15 Junioren Nord');

    expect(component.tileShowScorers).toBeTrue();
  });

  it('warnt in einer Jugendliga', () => {
    const component = build();
    component.game = gameIn('U15 Junioren Nord');

    expect(component.youthLeagueWarning).toBeTrue();
  });

  it('warnt in einer Erwachsenenliga nicht', () => {
    const component = build();
    component.game = gameIn('1. Bundesliga Herren');

    expect(component.youthLeagueWarning).toBeFalse();
  });

  it('kommt mit einem Spiel ohne Liganamen zurecht', () => {
    const component = build();
    component.game = {} as Game;

    expect(component.youthLeagueWarning).toBeFalse();
  });
});
