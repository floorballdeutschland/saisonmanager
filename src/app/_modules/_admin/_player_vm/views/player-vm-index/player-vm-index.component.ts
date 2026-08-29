import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { ClubService, PlayerService, SessionService } from '@floorball/core';
import {
  ClubWithTeams,
  Player,
  PlayerCurrentLicense,
  PlayerImportReport,
} from '@floorball/types';
import { Title } from '@angular/platform-browser';
import { downloadCsv } from 'src/app/_helpers/_utils/csv-export';

interface ClubPlayerList {
  club: ClubWithTeams;
  players: Player[];
  showDeactivated: boolean;
  // Der Import laeuft je Verein, also auch sein Zustand: Wer zwei Vereine
  // betreut, soll den Bericht des einen nicht am anderen sehen.
  showImport: boolean;
  importing: boolean;
  importReport: PlayerImportReport | null;
  importError: string | null;
}

@Component({
  templateUrl: './player-vm-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class PlayerVmIndexComponent implements OnInit, OnDestroy {
  clubLists: ClubPlayerList[] = [];
  loading = false;
  // Rückfall, solange die API das Feld `manage_players` je Verein noch nicht
  // liefert (Frontend-Deploy vor dem API-Deploy): die Vereine, in denen der
  // Account Vereinsmanager ist, plus die Verbandsrollen. Ungenauer als das
  // Feld, siehe canManagePlayers.
  vmClubIds: number[] = [];
  private _isAssociationRole = false;
  actionError: string | null = null;
  confirmDeactivateId: number | null = null;
  deactivateReason = '';
  deactivateReasonOther = '';

  private _destroy$ = new Subject<void>();

  constructor(
    private _clubService: ClubService,
    private _playerService: PlayerService,
    private _cdr: ChangeDetectorRef,
    private _title: Title,
    private _transloco: TranslocoService,
    private _sessionService: SessionService
  ) {
    this._title.setTitle('Floorball Saisonmanager Spielerliste (Verein)');
  }

  ngOnInit(): void {
    this._sessionService.currentUser$
      .pipe(takeUntil(this._destroy$))
      .subscribe((user) => {
        this.vmClubIds = user?.club_ids ?? [];
        this._isAssociationRole = !!user?.permissions?.['update_player'];
        this._cdr.markForCheck();
      });

    this.loading = true;
    // Bewusst NICHT adminGetClubAndTeams(): das liefert alle Vereine, auf die
    // irgendeine Rolle Zugriff gibt. Wer zusätzlich SBK ist, bekam damit alle
    // Vereine des Spielbetriebs in diese Vereinssicht – und weil für jeden
    // davon die Spielerliste geladen wird, quittierten die Vereine fremder
    // Landesverbände das mit 403, was über den ErrorInterceptor die komplette
    // Seite abbrach.
    this._clubService
      .vmGetClubAndTeams()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (clubs) => {
          if (!clubs.length) {
            this.loading = false;
            this._cdr.markForCheck();
            return;
          }
          forkJoin(
            clubs.map((club) => this._playerService.vmGetPlayers(club.id))
          )
            .pipe(takeUntil(this._destroy$))
            .subscribe({
              next: (playerLists) => {
                this.clubLists = clubs.map((club, i) => ({
                  club,
                  players: playerLists[i],
                  showDeactivated: false,
                  showImport: false,
                  importing: false,
                  importReport: null,
                  importError: null,
                }));
                this.loading = false;
                this._cdr.markForCheck();
              },
              error: () => {
                this.loading = false;
                this._cdr.markForCheck();
              },
            });
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  // Ein Badge pro Liga-Lizenz der laufenden Saison; solange die API das
  // Feld current_licenses noch nicht liefert, Fallback auf den bisherigen
  // Einzelstatus (dann ohne Liga-Kürzel).
  licenseBadges(player: Player): PlayerCurrentLicense[] {
    if (player.current_licenses?.length) {
      return player.current_licenses;
    }
    if (player.current_license_status_id) {
      return [
        {
          license_status_id: player.current_license_status_id,
          license_status: player.current_license_status ?? '',
          league_id: 0,
          league_short_name: '',
        },
      ];
    }
    return [];
  }

  badgeClass(statusId: number): string {
    if (statusId === 1) {
      return 'bg-green-100 text-green-800';
    }
    if (statusId === 2) {
      return 'bg-yellow-100 text-yellow-800';
    }
    return 'bg-red-100 text-red-800';
  }

  /**
   * Anlegen, Deaktivieren und Reaktivieren darf nur, wer den Bestand dieses
   * Vereins ordnet: der Vereinsmanager, dazu Admin und die zuständige SBK. Ein
   * Teammanager sieht denselben Bestand samt Lizenzstand und öffnet die
   * Profile, entscheidet aber nicht, wer im Verein steht. Der Anlege-Knopf
   * bleibt trotzdem stehen, damit an seiner Stelle die Begründung steht statt
   * einer Lücke. Die Prüfung selbst bleibt serverseitig.
   *
   * Maßgeblich ist das Feld am Verein (`manage_players` aus
   * vm/clubs_and_teams), nicht die Rollenliste im Browser: Die kennt den
   * Spielbetrieb eines Vereins nicht (eine Landes-SBK sähe damit auch Vereine
   * fremder Verbände als eigene) und steht nach einer Rechteänderung bis zur
   * nächsten Anmeldung veraltet da. Fehlt das Feld, greift der alte Rückfall,
   * damit ein Frontend-Deploy vor dem API-Deploy niemandem die Knöpfe nimmt.
   */
  canManagePlayers(list: ClubPlayerList): boolean {
    return (
      list.club.manage_players ??
      (this._isAssociationRole || this.vmClubIds.includes(list.club.id))
    );
  }

  /** Für die Einleitung: Beschreibt sie Knöpfe, die es hier überhaupt gibt? */
  get anyClubManageable(): boolean {
    return this.clubLists.some((list) => this.canManagePlayers(list));
  }

  visiblePlayers(list: ClubPlayerList): Player[] {
    return list.showDeactivated
      ? list.players
      : list.players.filter((p) => !p.deactivated_at);
  }

  deactivatedCount(list: ClubPlayerList): number {
    return list.players.filter((p) => p.deactivated_at).length;
  }

  /**
   * Liefert die API die E-Mail-Adresse überhaupt?
   *
   * Ohne diese Unterscheidung fielen zwei verschiedene Zustände zusammen: „das
   * Feld kam nicht mit" und „die Adresse ist nicht gepflegt". Frontend und API
   * werden getrennt ausgerollt, und `Player#meta_hash` führte das Feld bis
   * api#565 nicht — ein Frontend-Deploy davor hätte in jeder Zeile ein rotes
   * „fehlt" und über der Tabelle den ganzen Verein als lückenhaft gemeldet,
   * ohne Fehler und ohne Möglichkeit, das von echten Daten zu unterscheiden.
   * Die naheliegende Reaktion wäre, längst gepflegte Adressen neu zu erfassen.
   *
   * Solange das Feld fehlt, bleiben Spalte und Zähler deshalb ganz weg: Die
   * Maske sieht dann aus wie vorher, statt etwas Falsches zu behaupten.
   * Gleicher Rückfall-Gedanke wie bei `manage_players` in canManagePlayers.
   *
   * `'email' in p` und nicht `p.email != null`: Eine gepflegte Liste, in der
   * niemand eine Adresse hat, liefert den Schlüssel mit dem Wert null — das ist
   * eine Auskunft und keine fehlende.
   */
  emailKnown(list: ClubPlayerList): boolean {
    return list.players.some((p) => 'email' in p);
  }

  /**
   * Ist eine E-Mail-Adresse gepflegt?
   *
   * Eine Methode für Spalte und Zähler, damit beide dieselbe Auskunft geben.
   * `trim()` gegen ein leergeräumtes Feld: `update_email` normalisiert eine
   * leere Eingabe zu null, `create`/`update` über `player_params` dagegen nicht
   * (`validates :email, allow_blank: true`). Eine Leerzeichenkette ist also
   * weiterhin möglich, nicht nur im Altbestand, und wäre truthy.
   */
  hasEmail(player: Player): boolean {
    return !!player.email?.trim();
  }

  /**
   * Wie viele der gerade sichtbaren Personen keine E-Mail-Adresse haben.
   *
   * Bewusst über `visiblePlayers` und nicht über den ganzen Bestand: Die Zahl
   * steht direkt über der Tabelle und muss sich mit deren Spalte decken.
   * Deaktivierte zählen deshalb nur mit, solange sie eingeblendet sind.
   */
  missingEmailCount(list: ClubPlayerList): number {
    return this.visiblePlayers(list).filter((p) => !this.hasEmail(p)).length;
  }

  /**
   * Die Zeilen, die der Export ausgibt: die AKTIVEN Personen aller Vereine
   * dieser Seite.
   *
   * Bewusst nicht `visiblePlayers`: Der Schalter „deaktivierte einblenden"
   * steuert die Tabelle, nicht die Datei. Die Datei ist die Arbeitsgrundlage
   * fuer den laufenden Kader, und ein Bestand, dessen Umfang davon abhaengt,
   * welcher Schalter beim Herunterladen gerade stand, waere als Grundlage
   * unbrauchbar.
   */
  private get exportRows(): { list: ClubPlayerList; player: Player }[] {
    return this.clubLists.flatMap((list) =>
      list.players
        .filter((p) => !p.deactivated_at)
        .map((player) => ({ list, player }))
    );
  }

  /** Fuer den abgeblendeten Knopf: Gibt es ueberhaupt etwas zu exportieren? */
  get exportablePlayerCount(): number {
    return this.exportRows.length;
  }

  exportCsv(): void {
    const rows = this.exportRows;
    if (!rows.length) return;

    const t = (key: string) => this._transloco.translate(key);
    // Die Spaltennamen sind der Vertrag mit dem Import (die API loest die
    // Spalten ueber ihren Namen auf, nicht ueber die Position). Sie stehen
    // deshalb bewusst als deutscher Festtext hier und NICHT als
    // Uebersetzungsschluessel: Eine englische Kopfzeile ergaebe eine Datei, die
    // der eigene Import nicht mehr lesen kann.
    const headers = [
      'ID',
      'Verein',
      'Nachname',
      'Vorname',
      'Geburtsdatum',
      'Geschlecht',
      'Nationalität',
      'Nation-ID',
      'E-Mail',
      'Lizenzen',
    ];

    downloadCsv(
      'spieler',
      headers,
      rows.map(({ list, player }) => [
        player.id,
        list.club.name,
        player.last_name,
        player.first_name,
        this.exportBirthdate(player),
        this.exportGender(player),
        player.nation_string ?? '',
        player.nation_id ?? '',
        player.email ?? '',
        this.licenseBadges(player)
          .map((lic) =>
            [
              lic.license_status_id === 1
                ? t('playerVm.index.licenseLicensed')
                : lic.license_status_id === 2
                  ? t('playerVm.index.licenseRequested')
                  : lic.license_status,
              lic.league_short_name,
            ]
              .filter(Boolean)
              .join(' ')
          )
          .join(' | '),
      ])
    );
  }

  /**
   * Geburtsdatum als TT.MM.JJJJ, direkt aus dem ISO-String der API.
   *
   * Ohne `new Date()`: Ein Datum ohne Zeitanteil liest der Browser als UTC-
   * Mitternacht, und in einer Zeitzone hinter UTC verschiebt die Ausgabe um
   * einen Tag. Ein Geburtsdatum, das in der Datei einen Tag verschoben steht,
   * kaeme ueber den Import genau so zurueck.
   */
  private exportBirthdate(player: Player): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(player.birthdate ?? '');
    return match
      ? `${match[3]}.${match[2]}.${match[1]}`
      : (player.birthdate ?? '');
  }

  /**
   * Geschlecht als m/w/d.
   *
   * Gross-/Kleinschreibung wird ignoriert, und ein unbekannter Wert geht
   * unveraendert durch. Die Tabelle daneben schreibt jeden Wert ausser 'M' und
   * 'W' als „d" -- hier waere das falsch: Aus einem Altbestandswert 'm' wuerde
   * in der Datei ein „d", und der Import traegt ihn (bei leerem Feld) genau so
   * ein.
   */
  private exportGender(player: Player): string {
    const value = (player.gender ?? '').trim();
    return ['M', 'W', 'D'].includes(value.toUpperCase())
      ? value.toLowerCase()
      : value;
  }

  toggleImport(list: ClubPlayerList): void {
    list.showImport = !list.showImport;
    this._cdr.markForCheck();
  }

  onImportFile(list: ClubPlayerList, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    list.importing = true;
    list.importReport = null;
    list.importError = null;
    this._cdr.markForCheck();

    this._playerService
      .vmImportPlayers(list.club.id, file)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (report) => {
          list.importing = false;
          // Zuruecksetzen, damit dieselbe Datei nach einer Korrektur erneut
          // gewaehlt werden kann -- ohne das feuert `change` beim gleichen
          // Dateinamen nicht wieder.
          input.value = '';
          list.importReport = report;
          // Die eingetragenen Werte stehen sonst bis zum naechsten Seitenaufruf
          // nicht in der Tabelle, und die Zahl „X ohne E-Mail-Adresse" darueber
          // widerspraeche dem Bericht darunter.
          this._reloadPlayers(list);
          this._cdr.markForCheck();
        },
        error: (err) => {
          list.importing = false;
          input.value = '';
          // Die API meldet den Grund unter `message` (fehlende Spalte, kaputtes
          // Encoding). Er gehoert hierher und nicht in eine allgemeine Absage:
          // Er benennt, was an der Datei zu aendern ist.
          list.importError =
            err?.error?.message ??
            this._transloco.translate('playerVm.notifications.importError');
          this._cdr.markForCheck();
        },
      });
  }

  private _reloadPlayers(list: ClubPlayerList): void {
    this._playerService
      .vmGetPlayers(list.club.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (players) => {
          list.players = players;
          this._cdr.markForCheck();
        },
      });
  }

  /** „E-Mail: neu@example.org, Geburtsdatum: 01.02.2010" */
  fieldSummary(fields: Record<string, string>): string {
    return Object.entries(fields)
      .map(([field, value]) => `${this.fieldLabel(field)}: ${value}`)
      .join(', ');
  }

  /**
   * Die uebersprungenen Felder einer Zeile mit ihrem Grund. Leerer String, wenn
   * es keine gibt -- das Template blendet den Zusatz dann aus.
   */
  skippedFieldSummary(reasons: Record<string, string>): string {
    return Object.entries(reasons)
      .map(([field, reason]) =>
        field === 'row'
          ? this.skipReasonLabel(reason)
          : `${this.fieldLabel(field)}: ${this.skipReasonLabel(reason)}`
      )
      .join(', ');
  }

  private fieldLabel(field: string): string {
    const keys: Record<string, string> = {
      email: 'playerVm.index.colEmail',
      birthdate: 'playerVm.index.colBirthdate',
      gender: 'playerVm.index.colGender',
      nation_id: 'playerVm.index.colNation',
    };
    // Ein unbekannter Feldname (neueres Feld, aelteres Frontend) wird nicht
    // uebersetzt, aber auch nicht verschluckt.
    return keys[field] ? this._transloco.translate(keys[field]) : field;
  }

  private skipReasonLabel(reason: string): string {
    const keys: Record<string, string> = {
      already_set: 'playerVm.index.skipAlreadySet',
      identical: 'playerVm.index.skipIdentical',
      no_permission: 'playerVm.index.skipNoPermission',
      empty: 'playerVm.index.skipEmpty',
    };
    return keys[reason] ? this._transloco.translate(keys[reason]) : reason;
  }

  notFoundIds(report: PlayerImportReport): string {
    return report.not_found.map((entry) => entry.id).join(', ');
  }

  toggleDeactivated(list: ClubPlayerList): void {
    list.showDeactivated = !list.showDeactivated;
    this._cdr.markForCheck();
  }

  startDeactivate(player: Player): void {
    this.confirmDeactivateId = player.id;
    this.deactivateReason = '';
    this.deactivateReasonOther = '';
    this.actionError = null;
    this._cdr.markForCheck();
  }

  cancelDeactivate(): void {
    this.confirmDeactivateId = null;
    this.deactivateReason = '';
    this.deactivateReasonOther = '';
    this._cdr.markForCheck();
  }

  deactivate(list: ClubPlayerList, player: Player): void {
    this.confirmDeactivateId = null;
    this.actionError = null;
    // Der Grund geht wörtlich an die API, die nur das deutsche Präfix
    // akzeptiert – deshalb bewusst nicht übersetzt.
    const reason =
      this.deactivateReason === 'Sonstiges'
        ? `Sonstiges: ${this.deactivateReasonOther}`
        : this.deactivateReason;
    this._playerService
      .deactivatePlayer(player.id, reason)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          list.players = list.players.map((p) =>
            p.id === player.id ? updated : p
          );
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.actionError =
            err?.error?.message ??
            this._transloco.translate('playerVm.notifications.deactivateError');
          this.deactivateReason = '';
          this.deactivateReasonOther = '';
          this._cdr.markForCheck();
        },
      });
  }

  reactivate(list: ClubPlayerList, player: Player): void {
    this.actionError = null;
    this._playerService
      .reactivatePlayer(player.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          list.players = list.players.map((p) =>
            p.id === player.id ? updated : p
          );
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.actionError =
            err?.error?.message ??
            this._transloco.translate('playerVm.notifications.reactivateError');
          this._cdr.markForCheck();
        },
      });
  }
}
