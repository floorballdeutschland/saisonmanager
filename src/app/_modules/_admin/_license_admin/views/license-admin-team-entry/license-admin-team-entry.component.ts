import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { PlayerLicenseHistory } from '@floorball/types';

/**
 * Ein Statussymbol der Lizenzliste: Pfade im 24er-Raster, Farbe und der
 * Schlüssel des Klartextes für Tooltip und Vorlesetext.
 */
export interface LicenseStatusIcon {
  labelKey: string;
  colorClass: string;
  paths: string[];
}

/**
 * Der Kreis, in dem jedes Symbol steht. Die Statuszeile ist 20 Pixel hoch und
 * steht in einer Liste: Eine gemeinsame Außenform macht die Spalte ruhig, das
 * Innenzeichen trägt die Unterscheidung.
 */
const CIRCLE = 'M21 12a9 9 0 11-18 0 9 9 0 0118 0z';

/**
 * Ein Symbol je Lizenzstatus (License::NAMES in der API).
 *
 * Die Farbe sagt, ob der Spieler spielen darf: grün erteilt, gelb beantragt,
 * rot nicht spielberechtigt, grau ungültig. Innerhalb einer Farbe unterscheidet
 * die Form, denn `abgelehnt` und `gesperrt` sind beides Rot und `gelöscht`,
 * `ignoriert` und `zurückgezogen` beides Grau.
 *
 * Bis hierher gab es drei Symbole: Haken für erteilt, Kreuz für abgelehnt und
 * ein Fragezeichen für alles andere. In dem Fragezeichen lagen `beantragt`,
 * `zurückgezogen`, `gelöscht`, `ignoriert`, `gesperrt` und `Transfer`
 * gleichermaßen -- eine noch offene Lizenz sah aus wie eine gelöschte.
 */
const STATUS_ICONS: Record<number, LicenseStatusIcon> = {
  // erteilt: Haken
  1: {
    labelKey: 'licenseAdmin.teamEntry.status.approved',
    colorClass: 'text-green-600',
    paths: ['M9 12.75L11.25 15 15 9.75', CIRCLE],
  },
  // beantragt: Uhr -- die Entscheidung steht noch aus
  2: {
    labelKey: 'licenseAdmin.teamEntry.status.requested',
    colorClass: 'text-yellow-600',
    paths: ['M12 6v6h4.5', CIRCLE],
  },
  // abgelehnt: Kreuz
  3: {
    labelKey: 'licenseAdmin.teamEntry.status.denied',
    colorClass: 'text-red-600',
    paths: ['M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5', CIRCLE],
  },
  // gelöscht: Minus -- die Lizenz ist aus dem Bestand genommen
  4: {
    labelKey: 'licenseAdmin.teamEntry.status.deleted',
    colorClass: 'text-fb-gray-400',
    paths: ['M15 12H9', CIRCLE],
  },
  // Transfer: Pfeil nach rechts -- die Lizenz ist zu einer anderen Mannschaft
  // weitergezogen
  6: {
    labelKey: 'licenseAdmin.teamEntry.status.transfer',
    colorClass: 'text-blue-600',
    paths: ['M9 12h6m-2.25-2.25L15 12l-2.25 2.25', CIRCLE],
  },
  // ignoriert: Pause -- reiner Altbestand, stillgelegt statt gelöscht
  7: {
    labelKey: 'licenseAdmin.teamEntry.status.ignored',
    colorClass: 'text-fb-gray-400',
    paths: ['M10.5 9v6m3-6v6', CIRCLE],
  },
  // zurückgezogen: Pfeil nach links -- der Verein hat den Antrag zurückgeholt
  8: {
    labelKey: 'licenseAdmin.teamEntry.status.withdrawn',
    colorClass: 'text-fb-gray-400',
    paths: ['M15 12H9m2.25-2.25L9 12l2.25 2.25', CIRCLE],
  },
  // gesperrt: durchgestrichener Kreis
  9: {
    labelKey: 'licenseAdmin.teamEntry.status.suspended',
    colorClass: 'text-red-600',
    paths: ['M8.25 15.75l7.5-7.5', CIRCLE],
  },
};

/**
 * Fragezeichen wie bisher, jetzt aber nur noch für einen Status, den diese
 * Fassung nicht kennt -- nicht mehr als Sammelbecken für sechs bekannte.
 */
const UNKNOWN_ICON: LicenseStatusIcon = {
  labelKey: 'licenseAdmin.teamEntry.status.unknown',
  colorClass: 'text-fb-gray-400',
  paths: [
    'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75',
    CIRCLE,
    'M12 17.25h.008v.008H12v-.008z',
  ],
};

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

  /**
   * Symbol zum Status des jüngsten History-Eintrags.
   *
   * Die Status-ID liegt in der JSONB-History nicht typgarantiert vor (siehe
   * League#build_license_items, das an zwei Stellen `to_i` schreibt). Der
   * vorherige `@switch` in der Vorlage verglich streng: Eine erteilte Lizenz
   * mit '1' als Zeichenkette landete im Fragezeichen. Der Zugriff auf die
   * Tabelle trifft beide Schreibweisen, weil Objektschlüssel in JavaScript
   * ohnehin Zeichenketten sind; `Number()` sagt das ausdrücklich, statt es dem
   * nächsten Umbau zu überlassen.
   *
   * Fehlt die History ganz, bleibt es beim Fragezeichen -- ein Status, der
   * nicht dasteht, soll nicht als erteilt gelesen werden.
   */
  public get statusIcon(): LicenseStatusIcon {
    const statusId = Number(this.lastHistory?.license_status_id);
    return STATUS_ICONS[statusId] ?? UNKNOWN_ICON;
  }
}
