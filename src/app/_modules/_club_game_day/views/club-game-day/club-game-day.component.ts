import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { SessionService } from '@floorball/core';

@Component({
  templateUrl: './club-game-day.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ClubGameDayComponent {
  /** Zugang fuers Spielsekretariat: jeder Teammanager und Vereinsmanager. */
  readonly showSecretary: boolean;
  /**
   * Auswaertsspieltage bestaetigen. Der Menueschluessel erscheint nur, wenn
   * fuer eine eigene Mannschaft ein Spieltagsbericht greift. Die Rechte
   * stammen aber aus der Anmeldung: Legt ein Landesverband seine erste Frage
   * mitten in der Saison an, fehlt der Schluessel bis zur naechsten
   * Anmeldung. Wer ueber den Link aus der Mail kommt (`?reiter=auswaerts`),
   * sieht den Reiter deshalb mit dem rollenbasierten `page_team_game_days`.
   * Gleicher Gedanke wie am frueheren Guard der Einzelseite.
   */
  readonly showAway: boolean;
  /** Schiri-Feedback: nur fuer Mannschaften in feedbackpflichtigen Ligen. */
  readonly showFeedback: boolean;

  constructor(session: SessionService, route: ActivatedRoute, title: Title) {
    title.setTitle('Floorball Saisonmanager Spieltagsaufgaben');
    const permissions = session.currentUserValue?.permissions ?? {};
    const requested = route.snapshot.queryParamMap.get('reiter');
    this.showSecretary = !!permissions['page_secretary_links'];
    this.showAway =
      !!permissions['menu_item_team_game_days'] ||
      (!!permissions['page_team_game_days'] && requested === 'auswaerts');
    this.showFeedback = !!permissions['menu_item_referee_feedback'];
  }
}
