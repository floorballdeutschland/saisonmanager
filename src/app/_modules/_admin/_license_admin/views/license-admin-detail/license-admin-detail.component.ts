import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  Club,
  GfRole,
  League,
  PlayerLicense,
  PlayerOtherLicense,
  PlayerWithLicense,
  TeamWithPlayers,
} from '@floorball/types';
import { NotificationService, PlayerService } from '@floorball/core';
import { TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'fb-license-admin-detail',
  templateUrl: './license-admin-detail.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class LicenseAdminDetailComponent implements OnInit {
  @Input()
  initiallyOpen = false;

  @Input() set forceOpen(val: boolean) {
    this.open = val;
  }

  @Input()
  player!: PlayerWithLicense;

  @Input()
  team!: TeamWithPlayers;

  @Input()
  allClubs!: Club[];

  @Input()
  license!: PlayerLicense;

  @Input()
  league?: League;

  @Output() handledPlayer = new EventEmitter<number>();

  reasons: { [key: string]: string } = {};
  validUntilDates: { [key: string]: string } = {};
  gfRoles: { [key: string]: GfRole } = {};

  hidePlayer: { [key: number]: boolean } = {};

  open = false;

  constructor(
    private _playerService: PlayerService,
    private _notificationService: NotificationService,
    private _transloco: TranslocoService
  ) {}

  ngOnInit(): void {
    this.open = this.initiallyOpen;
    const licenseId = this.player?.team_license?.license?.id;
    if (licenseId) {
      this.validUntilDates[licenseId] = this.defaultValidUntil();
      if (this.gfRoleSelectable()) {
        // Sinnvolle Vorbelegung: Komplement zur bestehenden GF-Lizenz.
        const other = this.otherGfLicense();
        this.gfRoles[licenseId] =
          other?.gf_role === 'zweitlizenz' ? 'erstlizenz' : 'zweitlizenz';
      }
    }
  }

  // Ist die zu genehmigende Lizenz eine GF-Erwachsenen-Lizenz und hat der
  // Spieler bereits eine weitere aktive GF-Lizenz im selben Wettbewerb
  // (männlich/weiblich)? Nur dann gibt es eine Erst-/Zweitlizenz-Wahl.
  public gfRoleSelectable(): boolean {
    if (!this.league || this.league.field_size !== 'GF') return false;
    if (/^U\d/.test(this.league.age_group ?? '')) return false;
    return !!this.otherGfLicense();
  }

  public otherGfLicense(): PlayerOtherLicense | undefined {
    return (this.player?.other_licenses ?? []).find(
      (o) => o.gf_adult && o.female === this.league?.female
    );
  }

  public toggleDetails(): void {
    this.open = !this.open;
  }

  public getClubNameById(id: number): string {
    return (
      this.allClubs.find((club) => club.id === id)?.name ||
      this._transloco.translate('licenseAdmin.detail.unknown')
    );
  }

  public calculateAge(dateString: string): number {
    const today = new Date();
    const [y, m, d] = dateString.split('-').map(Number);
    const birthDate = new Date(y, m - 1, d);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age;
  }

  public defaultValidUntil(): string {
    const now = new Date();
    const year =
      now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear();
    return `${year}-07-31`;
  }

  public approveLicense(player: PlayerWithLicense) {
    const licenseId = player.team_license.license.id;
    const validUntil =
      this.validUntilDates[licenseId] || this.defaultValidUntil();
    const gfRole = this.gfRoleSelectable()
      ? this.gfRoles[licenseId]
      : undefined;

    this._playerService
      .updateLicenseStatus(
        player.id,
        licenseId,
        1,
        this.reasons[licenseId],
        validUntil,
        gfRole
      )
      .subscribe({
        next: () => {
          this.handledPlayer.emit(player.id);
          this.hidePlayer[player.id] = true;
          this._notificationService.success(
            this._transloco.translate(
              'licenseAdmin.notifications.licenseGranted',
              {
                firstName: player.first_name,
                lastName: player.last_name,
                id: player.id,
              }
            ),
            {
              autoClose: true,
              keepAfterRouteChange: false,
            }
          );
        },
        error: (err) => this.showActionError(err),
      });
  }

  public cancelLicense(player: PlayerWithLicense) {
    const licenseId = player.team_license.license.id;

    this._playerService
      .updateLicenseStatus(player.id, licenseId, 3, this.reasons[licenseId])
      .subscribe({
        next: () => {
          this.handledPlayer.emit(player.id);
          this.hidePlayer[player.id] = true;
          this._notificationService.success(
            this._transloco.translate(
              'licenseAdmin.notifications.requestRejected',
              {
                firstName: player.first_name,
                lastName: player.last_name,
                id: player.id,
              }
            ),
            {
              autoClose: true,
              keepAfterRouteChange: false,
            }
          );
        },
        error: (err) => this.showActionError(err),
      });
  }

  // Der globale ErrorInterceptor zeigt 422 nicht an (z. B. aktive Sperre oder
  // ungültige Erst-/Zweitlizenz-Zuordnung) – Meldung hier explizit ausgeben.
  private showActionError(err: {
    error?: { message?: string | object };
  }): void {
    const message =
      typeof err?.error?.message === 'string' ? err.error.message : undefined;
    this._notificationService.error(
      message ??
        this._transloco.translate('licenseAdmin.notifications.actionFailed'),
      { autoClose: false, keepAfterRouteChange: false }
    );
  }

  public docTypeLabel(docType: string): string {
    const labels: Record<string, string> = {
      id_copy: this._transloco.translate(
        'licenseAdmin.leagueDetail.docLabelIdCopy'
      ),
    };
    return labels[docType] ?? docType;
  }

  // Für diesen Spieler tatsächlich erforderliche Dokumentarten-Keys
  // (serverseitig aufgelöst); Fallback: Liga-Konfiguration.
  public requiredDocs(): string[] {
    return (
      this.player?.team_license?.required_documents ??
      this.league?.required_documents ??
      []
    );
  }

  public isDocumentsComplete(player: PlayerWithLicense): boolean {
    const docs = player.team_license?.documents;
    // Alle für den Spieler geforderten Dokumente (außer Einverständnis, das
    // nur Minderjährige betrifft) müssen hochgeladen sein.
    const filesMissing = (
      player.team_license?.required_documents ??
      this.league?.required_documents ??
      []
    )
      .filter((docType) => docType !== 'parental_consent')
      .some((docType) => !docs?.[docType + '_url']);
    if (filesMissing) return false;
    if (docs?.['id_copy'] === false) return false;
    const isMinor = player.birthdate
      ? this.calculateAge(player.birthdate) < 18
      : false;
    return !isMinor || !!docs?.parental_consent;
  }

  public resetLicenseToPending(player: PlayerWithLicense) {
    const licenseId = player.team_license.license.id;

    this._playerService
      .updateLicenseStatus(player.id, licenseId, 2, this.reasons[licenseId])
      .subscribe({
        next: () => {
          this.handledPlayer.emit(player.id);
          this.hidePlayer[player.id] = true;
          this._notificationService.success(
            this._transloco.translate(
              'licenseAdmin.notifications.licenseReset',
              {
                firstName: player.first_name,
                lastName: player.last_name,
                id: player.id,
              }
            ),
            {
              autoClose: true,
              keepAfterRouteChange: false,
            }
          );
        },
        error: (err) => this.showActionError(err),
      });
  }
}
