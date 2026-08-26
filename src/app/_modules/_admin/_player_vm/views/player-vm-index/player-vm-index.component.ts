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
import { ClubWithTeams, Player, PlayerCurrentLicense } from '@floorball/types';
import { Title } from '@angular/platform-browser';

interface ClubPlayerList {
  club: ClubWithTeams;
  players: Player[];
  showDeactivated: boolean;
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
   * Ist eine E-Mail-Adresse gepflegt?
   *
   * Eine Methode für Spalte und Zähler, damit beide dieselbe Auskunft geben.
   * `trim()` gegen ein leergeräumtes Feld: `update_email` speichert eine leere
   * Eingabe als null, ein Altbestand kann aber eine Leerzeichenkette tragen,
   * und die wäre truthy.
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
