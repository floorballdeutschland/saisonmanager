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
import { Observable, take } from 'rxjs';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';

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

  // Dokumente gelten pro Spieler (saisonübergreifend), nicht mehr pro Lizenz;
  // per_season-Dokumentarten zählen nur mit Upload aus der laufenden Saison.
  documents: Record<number, LicenseDocument[]> = {};
  currentSeasonId: number | null = null;
  uploadError: string | null = null;

  constructor(
    private _associationService: AssociationService,
    private _clubService: ClubService,
    private _playerService: PlayerService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title,
    private _notificationService: NotificationService,
    private _transloco: TranslocoService
  ) {
    this.associations$ = this._associationService.associations$;
  }

  public ngOnInit(): void {
    // Titel erst setzen, wenn der lazy geladene Scope 'admin/license' verfügbar
    // ist – im Konstruktor liefert translate() sonst nur den rohen Key-Pfad.
    this._transloco
      .selectTranslation('admin/license')
      .pipe(take(1))
      .subscribe(() =>
        this._metaTitle.setTitle(
          this._transloco.translate('licenseAdmin.teamDetail.metaTitle')
        )
      );

    this._associationService.currentSeasonId$.subscribe((seasonId) => {
      this.currentSeasonId = seasonId;
      this._cdr.markForCheck();
    });

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
          this.loadDocuments(p.id);
        });
        this._cdr.markForCheck();
      },
    });
  }

  public loadDocuments(playerId: number) {
    this._playerService.getLicenseDocuments(playerId).subscribe({
      next: (docs) => {
        this.documents[playerId] = docs;
        this._cdr.markForCheck();
      },
      error: () => {
        this.uploadError = this._transloco.translate(
          'licenseAdmin.notifications.documentsLoadError'
        );
        this._cdr.markForCheck();
      },
    });
  }

  public getDoc(playerId: number, type: string): LicenseDocument | undefined {
    const docs = this.documents[playerId] ?? [];
    const documentType = this.licenseHash?.document_types?.find(
      (dt) => dt.key === type
    );
    // per_season: nur Uploads aus der laufenden Saison gelten (gleiche Logik
    // wie serverseitig in LicenseDocumentPresentation).
    if (
      documentType?.validity === 'per_season' &&
      this.currentSeasonId !== null
    ) {
      return docs.find(
        (d) =>
          d.document_type === type &&
          Number(d.season_id) === Number(this.currentSeasonId)
      );
    }
    return docs.find((d) => d.document_type === type);
  }

  // Elternzustimmung anzeigen, wenn die API sie für diesen Antrag fordert
  // (altersaufgelöst zum Antragsdatum) – Fallback: Minderjährig nach Alter
  // heute (Flag-basierter Ablauf ohne Katalog-Eintrag).
  public needsConsentFor(p: PlayerWithLicense): boolean {
    if (p.required_documents?.includes('parental_consent')) return true;
    return this.isMinor(p.birthdate);
  }

  // Für diesen Spieler tatsächlich erforderliche Dokumentarten (serverseitig
  // aufgelöst); Elternzustimmung hat einen eigenen Block für Minderjährige.
  public requiredDocsFor(p: PlayerWithLicense): string[] {
    return (
      p.required_documents ??
      this.licenseHash?.required_documents ??
      []
    ).filter((docType) => docType !== 'parental_consent');
  }

  public docLabel(docType: string): string {
    return (
      this.licenseHash?.document_types?.find((dt) => dt.key === docType)
        ?.name ?? docType
    );
  }

  public docTemplateUrl(docType: string): string | null {
    return (
      this.licenseHash?.document_types?.find((dt) => dt.key === docType)
        ?.template_url ?? null
    );
  }

  public onFileSelected(event: Event, playerId: number, documentType: string) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploadError = null;
    this._playerService
      .uploadLicenseDocument(playerId, documentType, file)
      .subscribe({
        next: () => {
          input.value = '';
          this.loadDocuments(playerId);
        },
        error: (err) => {
          input.value = '';
          this.uploadError =
            err?.error?.errors?.join(', ') ??
            this._transloco.translate(
              'licenseAdmin.notifications.uploadFailed'
            );
          this._cdr.markForCheck();
        },
      });
  }

  public deleteDocument(playerId: number, documentId: number) {
    this._playerService.deleteLicenseDocument(playerId, documentId).subscribe({
      next: () => this.loadDocuments(playerId),
      error: () => {
        this.uploadError = this._transloco.translate(
          'licenseAdmin.notifications.documentDeleteError'
        );
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
            this._transloco.translate(
              'licenseAdmin.notifications.createRequestError'
            )
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
          this._transloco.translate(
            'licenseAdmin.notifications.recreateRequestError'
          )
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
            this._transloco.translate(
              'licenseAdmin.notifications.withdrawRequestError'
            )
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
