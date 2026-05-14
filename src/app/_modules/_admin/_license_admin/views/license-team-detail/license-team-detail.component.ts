import {
  ChangeDetectorRef,
  Component,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import {
  GameOperation,
  GameOperationWithClubs,
  LicenseDocument,
  LicenseHash,
  PlayerWithLicense,
} from '@floorball/types';
import {
  AssociationService,
  ClubService,
  PlayerService,
} from '@floorball/core';
import { Observable } from 'rxjs';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';

@Component({
  templateUrl: './license-team-detail.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class LicenseTeamDetailComponent implements OnInit {
  associations$: Observable<GameOperation[]>;

  goClubItems$?: Observable<GameOperationWithClubs[]>;

  licenseHash!: LicenseHash;
  teamId = 0;
  playerId = 0;
  expressLicense = false;

  documents: Record<string, LicenseDocument[]> = {};
  uploadError: string | null = null;

  constructor(
    private _associationService: AssociationService,
    private _clubService: ClubService,
    private _playerService: PlayerService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title
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

  public getDoc(
    licenseId: string,
    type: 'id_copy' | 'parental_consent'
  ): LicenseDocument | undefined {
    return this.documents[licenseId]?.find((d) => d.document_type === type);
  }

  public onFileSelected(
    event: Event,
    playerId: number,
    licenseId: string,
    documentType: 'id_copy' | 'parental_consent'
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

  public createLicenseRequest() {
    this._clubService
      .userCreateLicenseRequest(this.playerId, this.teamId, this.expressLicense)
      .subscribe({
        next: () => {
          this.expressLicense = false;
          this.loadUserLicenses();
        },
      });
  }

  public recreateLicenseRequest(playerId: number, licenseId: string) {
    // check if set!
    this._playerService.reenableLicenseRequest(playerId, licenseId).subscribe({
      next: () => {
        // reload user licenses
        this.loadUserLicenses();
      },
    });
  }

  public withdrawRequest(playerId: number, licenseId: string) {
    this._clubService
      .userWithdrawLicenseRequest(playerId, licenseId)
      .subscribe({
        next: () => {
          this.loadUserLicenses();
        },
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
