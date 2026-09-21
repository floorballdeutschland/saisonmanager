import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

/**
 * Ein Statussymbol der Lizenzliste: Pfade im 24er-Raster, Farbe und der
 * Schlüssel des Klartextes für Tooltip und Vorlesetext.
 */
export interface LicenseStatusIcon {
  readonly labelKey: string;
  readonly colorClass: string;
  readonly paths: readonly string[];
}

/**
 * Der Kreis, in dem jedes Symbol steht. Die Symbole sind klein (`w-5 h-5` in
 * der Vorlage) und stehen untereinander: Eine gemeinsame Außenform macht die
 * Spalte ruhig, das Innenzeichen trägt die Unterscheidung.
 */
const CIRCLE = 'M21 12a9 9 0 11-18 0 9 9 0 0118 0z';

/**
 * Ein Symbol je Lizenzstatus (License::NAMES in der API).
 *
 * Die Farbe sagt, ob der Spieler spielen darf: grün erteilt, gelb beantragt,
 * rot nicht spielberechtigt, grau ohne Spielberechtigung aus einem Grund, der
 * niemanden mehr betrifft (gelöscht, ignoriert, zurückgezogen, weitergezogen).
 * Sie folgt damit derselben Einteilung wie `licenseStatusBadgeClass`
 * (_helpers/_utils/license-status.ts), die das Statusabzeichen der
 * Lizenzlisten färbt -- dasselbe Merkmal soll nicht zweimal verschieden
 * beantwortet werden. Innerhalb einer Farbe unterscheidet die Form, denn
 * `abgelehnt` und `gesperrt` sind beides Rot und vier Status sind Grau.
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
  // weitergezogen. Grau wie die übrigen ungültigen: `licenseStatusBadgeClass`
  // führt für 6 keinen eigenen Fall und färbt das Abzeichen ebenfalls grau.
  6: {
    labelKey: 'licenseAdmin.teamEntry.status.transfer',
    colorClass: 'text-fb-gray-400',
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

  /**
   * Die Statuskennung, die die Zeile zeigt. Der Aufrufer sucht sie heraus:
   * bevorzugt `effective_status_id` der API (Sperren eingerechnet), sonst aus
   * dem jüngsten History-Eintrag. Optional, weil eine Lizenz ohne History
   * keine hat.
   */
  @Input()
  statusId?: number | string | null;

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
   * Symbol zur übergebenen Statuskennung.
   *
   * Woher sie stammt, entscheidet der Aufrufer (siehe `statusId`). Diese Zeile
   * zeigt, was sie bekommt.
   *
   * `Number()` trifft die Tabelle typrichtig: Die Status-ID liegt in der
   * JSONB-History nicht typgarantiert vor -- die API wandelt sie mehrfach mit
   * `to_i` um (League#build_license_items) --, und ein Zugriff mit einer
   * Zeichenkette wäre auf `Record<number, …>` ein Übersetzungsfehler.
   * Randschreibweisen wie `'01'` nimmt die Umwandlung mit. Der vorherige
   * `@switch` in der Vorlage verglich streng: Eine erteilte Lizenz mit '1' als
   * Zeichenkette landete im Fragezeichen.
   *
   * Der Rückfall ist ausdrücklich getypt, weil `Record<number, …>` ohne
   * `noUncheckedIndexedAccess` für jede Zahl einen Treffer behauptet und das
   * `??` sonst wie toter Code aussieht. Fehlt der Eintrag ganz, bleibt es beim
   * Fragezeichen -- ein Status, der nicht dasteht, soll nicht als erteilt
   * gelesen werden.
   */
  public get statusIcon(): LicenseStatusIcon {
    const icon: LicenseStatusIcon | undefined =
      STATUS_ICONS[Number(this.statusId)];
    return icon ?? UNKNOWN_ICON;
  }
}
