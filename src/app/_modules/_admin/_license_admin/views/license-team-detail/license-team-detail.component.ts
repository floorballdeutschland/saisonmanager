import {
  ChangeDetectorRef,
  Component,
  OnInit,
  ViewEncapsulation,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  GameOperation,
  GameOperationWithClubs,
  LicenseDocument,
  LicenseHash,
  Player,
  PlayerWithLicense,
} from '@floorball/types';
import {
  AssociationService,
  ClubService,
  NotificationService,
  PlayerService,
} from '@floorball/core';
import { Observable } from 'rxjs';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';

@Component({
  templateUrl: './license-team-detail.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class LicenseTeamDetailComponent implements OnInit {
  associations$: Observable<GameOperation[]>;

  goClubItems$?: Observable<GameOperationWithClubs[]>;

  licenseHash!: LicenseHash;
  teamId = 0;
  playerId = 0;
  expressLicense = false;
  minorConsent = false;
  guardianEmail = '';

  documents: Record<string, LicenseDocument[]> = {};
  uploadError: string | null = null;

  constructor(
    private _associationService: AssociationService,
    private _clubService: ClubService,
    private _playerService: PlayerService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title,
    private _notificationService: NotificationService
  ) {
    this.associations$ = this._associationService.associations$;
    this._metaTitle.setTitle(
      'Floorball Saisonmanager Lizenzverwaltung (Team: )'
    );
  }

  public ngOnInit(): void {
    this._route.params.subscribe((params) => {
      if (params['teamId']) {
        this.teamId = params['teamId'];
        this.loadUserLicenses();
      }
    });
  }

  public loadUserLicenses() {
    this._clubService.userGetTeamLicenses(this.teamId).subscribe({
      next: (result) => {
        this.licenseHash = result;
        this.documents = {};
        result.current_requests.forEach((p) => {
          this.loadDocuments(p.id, p.team_license.id);
        });
        this._cdr.markForCheck();
      },
    });
  }

  public loadDocuments(playerId: number, licenseId: string) {
    this._playerService.getLicenseDocuments(playerId, licenseId).subscribe({
      next: (docs) => {
        this.documents[licenseId] = docs;
        this._cdr.markForCheck();
      },
      error: () => {
        this.uploadError = 'Dokumente konnten nicht geladen werden.';
        this._cdr.markForCheck();
      },
    });
  }

  public getDoc(licenseId: string, type: string): LicenseDocument | undefined {
    return this.documents[licenseId]?.find((d) => d.document_type === type);
  }

  public onFileSelected(
    event: Event,
    playerId: number,
    licenseId: string,
    documentType: string
  ) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploadError = null;
    this._playerService
      .uploadLicenseDocument(playerId, licenseId, documentType, file)
      .subscribe({
        next: () => {
          input.value = '';
          this.loadDocuments(playerId, licenseId);
        },
        error: (err) => {
          input.value = '';
          this.uploadError =
            err?.error?.errors?.join(', ') ?? 'Upload fehlgeschlagen.';
          this._cdr.markForCheck();
        },
      });
  }

  public deleteDocument(
    playerId: number,
    licenseId: string,
    documentId: number
  ) {
    this._playerService.deleteLicenseDocument(playerId, documentId).subscribe({
      next: () => this.loadDocuments(playerId, licenseId),
      error: () => {
        this.uploadError = 'Dokument konnte nicht gelöscht werden.';
        this._cdr.markForCheck();
      },
    });
  }

  public isMinor(birthdate: string): boolean {
    if (!birthdate) return false;
    const dob = new Date(birthdate);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    if (
      today.getMonth() < dob.getMonth() ||
      (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())
    ) {
      age--;
    }
    return age < 18;
  }

  get selectedPlayer(): Player | undefined {
    return this.licenseHash?.other_players?.find(
      (p) => p.id === +this.playerId
    );
  }

  get needsMinorConsent(): boolean {
    const sp = this.selectedPlayer;
    return !!(
      this.licenseHash?.parental_consent_required &&
      sp &&
      this.isMinor(sp.birthdate)
    );
  }

  get submitDisabled(): boolean {
    if (!this.needsMinorConsent) return false;
    return !this.minorConsent || !this.guardianEmail.trim();
  }

  public onPlayerChange() {
    this.minorConsent = false;
    this.guardianEmail = '';
  }

  // Der ErrorInterceptor reicht den Fehler bereits als String (Server-Message)
  // durch; nur 401/403/404/500/0 lösen dort eine Notification aus. 422-Antworten
  // (z. B. Altersgrenze, Sperre, Doppelantrag) blieben sonst unsichtbar.
  private _showRequestError(err: unknown, fallback: string) {
    const msg = typeof err === 'string' && err ? err : fallback;
    this._notificationService.error(msg, {
      autoClose: false,
      keepAfterRouteChange: false,
    });
    this._cdr.markForCheck();
  }

  public createLicenseRequest() {
    this._clubService
      .userCreateLicenseRequest(
        this.playerId,
        this.teamId,
        this.expressLicense,
        this.needsMinorConsent ? this.guardianEmail : undefined,
        this.needsMinorConsent ? new Date().toISOString() : undefined
      )
      .subscribe({
        next: () => {
          this.expressLicense = false;
          this.minorConsent = false;
          this.guardianEmail = '';
          this.loadUserLicenses();
        },
        error: (err) =>
          this._showRequestError(
            err,
            'Lizenzantrag konnte nicht erstellt werden.'
          ),
      });
  }

  public recreateLicenseRequest(playerId: number, licenseId: string) {
    // check if set!
    this._playerService.reenableLicenseRequest(playerId, licenseId).subscribe({
      next: () => {
        // reload user licenses
        this.loadUserLicenses();
      },
      error: (err) =>
        this._showRequestError(
          err,
          'Lizenzantrag konnte nicht erneut gestellt werden.'
        ),
    });
  }

  public withdrawRequest(playerId: number, licenseId: string) {
    this._clubService
      .userWithdrawLicenseRequest(playerId, licenseId)
      .subscribe({
        next: () => {
          this.loadUserLicenses();
        },
        error: (err) =>
          this._showRequestError(
            err,
            'Lizenzantrag konnte nicht zurückgezogen werden.'
          ),
      });
  }

  public isInGracePeriod(p: PlayerWithLicense): boolean {
    if (!p.grace_period_ends_at) return false;
    return new Date(p.grace_period_ends_at) > new Date();
  }

  public gracePeriodLabel(p: PlayerWithLicense): string {
    if (!p.grace_period_ends_at) return '';
    return (
      new Intl.DateTimeFormat('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Berlin',
      }).format(new Date(p.grace_period_ends_at)) + ' Uhr'
    );
  }
}
