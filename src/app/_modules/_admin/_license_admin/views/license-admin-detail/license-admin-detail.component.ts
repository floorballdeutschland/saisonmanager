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
        this.gfRoles[licenseId] = this.defaultGfRole();
      }
    }
  }

  // Ist die zu genehmigende Lizenz eine GF-Erwachsenen-Lizenz und hat der
  // Spieler bereits eine weitere aktive GF-Lizenz im selben Wettbewerb
  // (männlich/weiblich)? Nur dann gibt es eine Erst-/Zweitlizenz-Wahl.
  public gfRoleSelectable(): boolean {
    if (!this.league || this.league.field_size !== 'GF') return false;
    if (/^U\d/.test(this.league.age_group ?? '')) return false;
    return this.gfPartnerLicenses().length > 0;
  }

  // Alle weiteren aktiven GF-Lizenzen des Wettbewerbs. Entscheidungen müssen
  // über alle laufen: apply_gf_role auf der API-Seite bucht bei 'erstlizenz'
  // jede Partner-Lizenz gegen, nicht nur eine.
  public gfPartnerLicenses(): PlayerOtherLicense[] {
    return (this.player?.other_licenses ?? []).filter(
      (o) => o.gf_adult && o.female === this.league?.female
    );
  }

  // Erste Partner-Lizenz, allein für die Anzeige im Hinweistext.
  public otherGfLicense(): PlayerOtherLicense | undefined {
    return this.gfPartnerLicenses()[0];
  }

  // Vorbelegung der Auswahl. Eine Regel schreibt sie nicht vor – die Zuordnung
  // ist die Wahl des Spielers, die SBK/Admin nur dokumentieren – gesucht ist
  // also der plausibelste Vorschlag:
  //
  // 1. Trägt eine Partner-Lizenz schon 'erstlizenz', bleibt für diese hier nur
  //    die Zweitlizenz.
  // 2. Ist eine Partner-Lizenz ausdrücklich 'zweitlizenz', wird diese hier die
  //    Erstlizenz.
  // 3. Ist eine Partner-Lizenz bereits erteilt und noch ohne Zuordnung, ist sie
  //    die naheliegende Erstlizenz – die hier zu genehmigende wird Zweitlizenz.
  // 4. Sind alle Partner-Lizenzen selbst nur beantragt, ist diese hier die
  //    erste, die erteilt wird: Erstlizenz.
  //
  // Fall 4 war der gemeldete Fehler. Die alte Fassung prüfte nur auf
  // 'zweitlizenz' und schlug dort 'zweitlizenz' vor; die Genehmigung hob dann
  // per Gegenbuchung die noch nicht erteilte Partner-Lizenz zur Erstlizenz.
  private defaultGfRole(): GfRole {
    const partners = this.gfPartnerLicenses();
    if (partners.some((p) => p.gf_role === 'erstlizenz')) return 'zweitlizenz';
    if (partners.some((p) => p.gf_role === 'zweitlizenz')) return 'erstlizenz';
    if (partners.some((p) => !p.gf_role && p.last_status_id === 1)) {
      return 'zweitlizenz';
    }
    return 'erstlizenz';
  }

  // Bucht die Genehmigung als Erstlizenz Partner-Lizenzen zur Zweitlizenz um?
  // Maßgeblich sind alle Partner, nicht nur der angezeigte.
  public gfRoleDemotesPartners(licenseId: string): boolean {
    return (
      this.gfRoles[licenseId] === 'erstlizenz' &&
      this.gfPartnerLicenses().some((p) => p.gf_role !== 'zweitlizenz')
    );
  }

  // Übersetzungsschlüssel für den Status der anderen GF-Lizenz. Ohne diesen
  // Hinweis las sich eine bloß beantragte Lizenz wie eine bereits erteilte
  // ("Bestehende GF-Lizenz …") und die Zuordnung wirkte unbegründet.
  public otherGfLicenseStatusKey(): string {
    const statusId = this.otherGfLicense()?.last_status_id;
    if (statusId === 1) return 'licenseAdmin.detail.gfRoleOtherApproved';
    if (statusId === 2) return 'licenseAdmin.detail.gfRoleOtherRequested';
    return 'licenseAdmin.detail.gfRoleOtherUnknown';
  }

  // Nur die Lizenzen der Saison anzeigen, in der diese Liga läuft. Ältere
  // Saisons – u. a. Legacy-Importe, deren Teams eine hohe ID haben und daher
  // die team_id-Heuristik der API passieren – blenden wir hier aus. Fehlt die
  // season_id der Liga, zeigen wir sicherheitshalber alles.
  public currentSeasonLicenses(): PlayerLicense[] {
    const licenses = this.player?.licenses ?? [];
    const seasonId = this.league?.season_id;
    if (seasonId == null) return licenses;
    return licenses.filter(
      (l) => l.season_id != null && String(l.season_id) === String(seasonId)
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
      this.requiredDocsFromLeague(this.player)
    );
  }

  // Elternzustimmung verlangt die Liga, nicht das Geburtsdatum allein: Vorher
  // meldete die Ansicht sie bundesweit bei jeder minderjährigen Person als
  // fehlend, auch in Ligen ohne diese Pflicht.
  public needsParentalConsent(): boolean {
    return this.requiredDocs().includes('parental_consent');
  }

  public isDocumentsComplete(player: PlayerWithLicense): boolean {
    const docs = player.team_license?.documents;
    // Serverseitig aufgelöste Liste (Alter am Tag der Beantragung). Der
    // Fallback greift nur, wenn sie ausnahmsweise fehlt; er darf die
    // Elternzustimmung nicht verlieren, sonst genehmigt die SBK eine Lizenz
    // als „vollständig", der die Zustimmung fehlt.
    const requiredDocs: string[] =
      player.team_license?.required_documents ??
      this.requiredDocsFromLeague(player);
    // Alle geforderten Dokumente außer der Einverständniserklärung müssen als
    // Datei vorliegen; für die gibt es unten den eigenen Nachweis.
    const filesMissing = requiredDocs
      .filter((docType) => docType !== 'parental_consent')
      .some((docType) => !docs?.[docType + '_url']);
    if (filesMissing) return false;
    if (docs?.['id_copy'] === false) return false;
    if (!requiredDocs.includes('parental_consent')) return true;
    return !!docs?.parental_consent;
  }

  // Elternzustimmung kommt aus dem Liga-Flag oder aus den Pflichtdokumenten der
  // Liga; ohne serverseitige Auflösung bleibt nur das Alter von heute.
  private requiredDocsFromLeague(player?: PlayerWithLicense): string[] {
    const keys = [...(this.league?.required_documents ?? [])];
    const isMinor = player?.birthdate
      ? this.calculateAge(player.birthdate) < 18
      : false;
    if (
      this.league?.parental_consent_required &&
      isMinor &&
      !keys.includes('parental_consent')
    ) {
      keys.push('parental_consent');
    }
    return keys;
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
