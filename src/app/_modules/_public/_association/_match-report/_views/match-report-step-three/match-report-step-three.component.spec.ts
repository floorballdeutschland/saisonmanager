import { ChangeDetectorRef } from '@angular/core';
import { Game } from '@floorball/types';
import { LeagueService } from '@floorball/core';
import { MatchReportStepThreeComponent } from './match-report-step-three.component';

// Die Klasse direkt bauen statt über das TestBed: Geprüft wird die Ableitung
// der Voreinstellung aus dem Liganamen, und dafür braucht es die 365 Zeilen
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

describe('MatchReportStepThreeComponent: Voreinstellung der Torschützennamen', () => {
  // Der eigentliche Punkt: Die Kachel geht in die sozialen Netze. Namen
  // Minderjähriger dürfen nicht ohne Zutun daraufstehen.
  it('nennt in einer Jugendliga keine Namen, solange niemand es verlangt', () => {
    const component = build();
    component.game = gameIn('U15 Junioren Nord');

    expect(component.tileShowScorers).toBe(false);
  });

  it('nennt sie in einer Erwachsenenliga', () => {
    const component = build();
    component.game = gameIn('1. Bundesliga Herren');

    expect(component.tileShowScorers).toBe(true);
  });

  it('haelt die Handeingabe gegen ein erneutes Setzen des Spiels', () => {
    const component = build();
    component.game = gameIn('U15 Junioren Nord');

    component.tileShowScorers = true;
    component.onShowScorersToggled();

    // Der Spielbericht lädt das Spiel nach dem Speichern neu. Ohne das Merken
    // der Handeingabe kippte der Schalter dabei zurück.
    component.game = gameIn('U15 Junioren Nord');

    expect(component.tileShowScorers).toBe(true);
  });

  it('kommt mit einem Spiel ohne Liganamen zurecht', () => {
    const component = build();
    component.game = {} as Game;

    expect(component.tileShowScorers).toBe(true);
  });
});
