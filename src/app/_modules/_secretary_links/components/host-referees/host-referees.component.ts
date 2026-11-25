import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import {
  SecretaryHostAssignment,
  SecretaryHostGame,
  SecretaryHostPerson,
} from '@floorball/types';

type PublishedAssignment = Extract<
  SecretaryHostAssignment,
  { status: 'published' }
>;

/**
 * Die angesetzten Schiedsrichter eines Heimspieltags mit E-Mail, damit der
 * Ausrichter das Gespann einladen kann (api#935).
 *
 * Bisher kamen die Adressen nur mit der Ausrichter-Mail bei der
 * Veröffentlichung. Gast-Schiedsrichter stehen in keiner Vereinsliste, für
 * sie war die Mail der einzige Weg. Was hier steht, entspricht dem Inhalt
 * dieser Mail: Name und E-Mail, keine Telefonnummer.
 */
@Component({
  selector: 'fb-host-referees',
  templateUrl: './host-referees.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class HostRefereesComponent {
  @Input() games: SecretaryHostGame[] = [];

  published(game: SecretaryHostGame): PublishedAssignment | null {
    const assignment = game.referee_assignment;
    return assignment?.status === 'published' ? assignment : null;
  }

  /** Alle Personen des Spiels mit Adresse, für den gemeinsamen Mail-Link. */
  people(assignment: PublishedAssignment): SecretaryHostPerson[] {
    return [...assignment.referees, assignment.coach].filter(
      (p): p is SecretaryHostPerson => !!p
    );
  }

  /** `mailto:` an alle Adressen des Spiels, `null` ohne Adresse. */
  mailtoAll(assignment: PublishedAssignment): string | null {
    const emails = this.people(assignment)
      .map((p) => p.email)
      .filter((e): e is string => !!e);
    return emails.length > 0 ? `mailto:${emails.join(',')}` : null;
  }

  teams(game: SecretaryHostGame): string {
    return [game.home_team, game.guest_team].map((t) => t ?? '?').join(' – ');
  }
}
