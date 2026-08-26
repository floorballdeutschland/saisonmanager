import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { PlayerLicenseHistory } from '@floorball/types';

/**
 * Eine Zeile der Lizenzliste in der Genehmigungskarte: Statussymbol,
 * Mannschaft, Liga.
 *
 * Die Namen kommen als Eingaben herein und werden nicht mehr nachgeholt.
 * Vorher lud diese Komponente je Zeile `admin/teams/:id`, und dieser Abruf ist
 * auf den Spielbetrieb der Liga der Mannschaft begrenzt
 * (TeamsController#can_read_admin_team?). Bei einer Zweitlizenz in einem
 * anderen Verband antwortete er mit 403, und der generische 403-Zweig des
 * ErrorInterceptor warf die zuständige SBK aus ihrer EIGENEN Liga auf die
 * Startseite -- samt Suche, Filtern und Seitenzahl der Antragsliste, und bevor
 * sie über den Antrag entscheiden konnte. Belegt im Zugriffsprotokoll vom
 * 26.08.2026: 200 auf `admin/leagues/2465/licenses`, unmittelbar danach 403 auf
 * `admin/teams/9664`, der 2.-Bundesliga-Mannschaft desselben Spielers.
 *
 * api#555 liefert `team_name` und `league_name` an jeder Lizenz derselben
 * Antwort mit. Das spart nicht nur den 403, sondern einen Aufruf je Zeile.
 */
@Component({
  selector: 'fb-license-admin-team-entry',
  templateUrl: './license-admin-team-entry.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class LicenseAdminTeamEntryComponent {
  @Input()
  teamId!: number;

  @Input()
  lastHistory!: PlayerLicenseHistory;

  /**
   * Aus der Lizenz der Liga-Antwort. Fehlt der Name, ist die Mannschaft nicht
   * auflösbar (gelöscht) oder die API älter als api#555; die Zeile zeigt dann
   * wie bisher die Kennung allein, statt leer zu bleiben.
   */
  @Input()
  teamName?: string | null;

  @Input()
  leagueName?: string | null;
}
