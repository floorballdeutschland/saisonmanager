import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  AssociationService,
  ClubService,
  NotificationService,
  PlayerChangeRequestService,
  PlayerService,
  SessionService,
} from '@floorball/core';
import {
  Club,
  CorrectionType,
  DocumentType,
  GenderKey,
  GfRole,
  LicenseDocument,
  Nation,
  Player,
  PlayerLicense,
  PlayerSuspension,
  Season,
} from '@floorball/models';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { PLAYER_GENDERS } from '@floorball/types';

// Lizenzen des Spielers, nach Saison gruppiert (aktuelle Saison zuerst).
export interface LicenseSeasonGroup {
  seasonId?: string;
  name: string;
  current: boolean;
  licenses: PlayerLicense[];
}

@Component({
  templateUrl: './player-edit.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class PlayerEditComponent implements OnInit, OnDestroy {
  /** Serverseitige Obergrenze für Dokument-Uploads (LicenseDocument::MAX_FILE_SIZE). */
  static readonly MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;

  permissions: { [key: string]: boolean } = {};
  player?: Player;
  nations?: Nation[] = [];
  allClubs: Club[] = [];
  club_id?: number;

  // Vereine, für die eine neue Freigabe möglich ist: alles außer aktiven
  // Zweitmitgliedschaften und dem Heimatverein. Als Feld statt als Getter, weil
  // das Suchfeld sonst bei jeder Change-Detection eine neue Liste bekäme.
  assignableClubs: Club[] = [];

  additionalClubId: number | null = null;

  editMode = true;
  confirmDeactivate = false;
  deactivateReason = '';
  deactivateReasonOther = '';

  changeRequestType: CorrectionType | '' = '';
  changeRequestValue = '';
  changeRequestSent = false;
  changeRequestSubmitting = false;

  // Duplikat-Auswahl für Merge-Anträge (correction_type 'merge'): aktive
  // Spieler des eigenen Vereins ohne das gerade geöffnete Profil.
  mergeClubPlayers: Player[] = [];
  // Beschriftung „Nachname, Vorname (Geburtsdatum)" fuer das Suchfeld; wird
  // beim Laden gebildet, damit die Liste eine stabile Referenz behaelt.
  mergePlayerOptions: { id: number; label: string }[] = [];
  mergeSecondaryId: number | null = null;
  mergeLoadingPlayers = false;

  // Lizenz-Dokumente des Spielers (saisonübergreifend). Die Sichtbarkeit
  // (bundesweit vs. verbandsspezifisch) filtert bereits die API abhängig vom
  // Verbands-Scope des angemeldeten Nutzers.
  licenseDocuments: LicenseDocument[] = [];
  /** Abruf der Dokumente gescheitert (meist 403) – von „keine vorhanden" zu unterscheiden. */
  documentsFailed = false;

  // Dokumentarten, die für diesen Spieler hochgeladen werden können: global
  // gültige plus die seines Heimat-Spielbetriebs, ohne die altersmäßig
  // erledigten. Die Auswahl kommt vom Server, nicht aus dem Katalog-Abruf, der
  // nur Admin und SBK offensteht.
  availableDocumentTypes: DocumentType[] = [];
  documentTypesFailed = false;
  uploadDocumentType = '';
  uploading = false;
  /** Meldungen der API (422) – bereits benutzerlesbar, daher unübersetzt. */
  uploadErrors: string[] = [];
  /** Eigener Fehler als Übersetzungsschlüssel (Datei zu groß, Abruf gescheitert). */
  uploadErrorKey: string | null = null;
  /** Dokument, für das die Löschbestätigung offen ist. */
  confirmDeleteDocumentId: number | null = null;

  seasons: Season[] = [];
  currentSeasonId?: number;

  suspensions: PlayerSuspension[] = [];
  // Ebene 1: id der Lizenz, für die gerade das Sperr-Formular offen ist
  suspendLicenseId: string | null = null;
  licenseSuspendUntil = '';
  licenseSuspendReason = '';
  // Ebene 2: Beantragungssperre
  showApplicationBlockForm = false;
  blockFrom = '';
  blockUntil = '';
  blockReason = '';

  private _destroy$ = new Subject<boolean>();

  constructor(
    private _playerService: PlayerService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef,
    private _sessionService: SessionService,
    private _clubService: ClubService,
    private _router: Router,
    private _notificationService: NotificationService,
    private _changeRequestService: PlayerChangeRequestService,
    private _associationService: AssociationService,
    private _metaTitle: Title
  ) {
    this._metaTitle.setTitle('Floorball Saisonmanager Spielerverwaltung');
  }

  public ngOnInit(): void {
    this._route.params.subscribe((params) => {
      this.club_id = params['clubId'];
      this.getNations();
      this.getAllClubs();

      if (params['playerId']) {
        this.getPlayer(params['playerId']);
      } else {
        this.editMode = false;
        this.newPlayer();
      }
    });

    this._sessionService.currentUser$.subscribe({
      next: (user) => {
        this.permissions = user?.permissions || {};
      },
    });

    this._associationService.seasons$
      .pipe(takeUntil(this._destroy$))
      .subscribe((seasons) => {
        this.seasons = seasons ?? [];
        this._cdr.markForCheck();
      });
    this._associationService.currentSeasonId$
      .pipe(takeUntil(this._destroy$))
      .subscribe((id) => {
        this.currentSeasonId = id;
        this._cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next(true);
    this._destroy$.complete();
  }

  public getPlayer(id: string): void {
    // Der Wechsel von einem Profil zum naechsten laeuft ueber dieselbe Instanz
    // (route.params), sonst stuende die Auswahl oder Fehlermeldung des vorigen
    // Spielers noch da.
    this._resetDocumentUploadState();

    // Im Profil die vollständige, saisonübergreifende Lizenzhistorie laden.
    this._playerService.getPlayer(parseInt(id), true).subscribe({
      next: (result) => {
        this.player = result;
        this.loadSuspensions();
        this.loadLicenseDocuments();
        this.loadAvailableDocumentTypes();
        this._refreshAssignableClubs();

        this._cdr.markForCheck();
      },
    });
  }

  public loadLicenseDocuments(): void {
    if (!this.player?.id) return;

    this.documentsFailed = false;
    this._playerService.getLicenseDocuments(this.player.id).subscribe({
      next: (result) => {
        this.licenseDocuments = result;
        this._cdr.markForCheck();
      },
      // Ohne diesen Zweig bliebe die Liste leer und die Ansicht meldete „keine
      // Dokumente vorhanden" – also eine Tatsachenbehauptung, wo in Wahrheit
      // nur der Abruf gescheitert ist. Häufigster Fall ist ein 403: Der Spieler
      // ist sichtbar, seine Unterlagen aber nicht.
      error: () => {
        this.licenseDocuments = [];
        this.documentsFailed = true;
        this._cdr.markForCheck();
      },
    });
  }

  // Dokumente nach Landesverband/Spielbetrieb gruppiert; bundesweit gültige
  // Dokumentarten (game_operation_id = null) zuerst, danach alphabetisch nach
  // Verbandsname.
  public get documentGroups(): {
    gameOperationId: number | null;
    gameOperationName: string | null;
    documents: LicenseDocument[];
  }[] {
    const groups = new Map<
      string,
      {
        gameOperationId: number | null;
        gameOperationName: string | null;
        documents: LicenseDocument[];
      }
    >();

    for (const doc of this.licenseDocuments) {
      const goId = doc.game_operation_id ?? null;
      const key = goId === null ? 'global' : String(goId);
      let group = groups.get(key);
      if (!group) {
        group = {
          gameOperationId: goId,
          gameOperationName: doc.game_operation_name ?? null,
          documents: [],
        };
        groups.set(key, group);
      }
      group.documents.push(doc);
    }

    return Array.from(groups.values()).sort((a, b) => {
      if (a.gameOperationId === null) return -1;
      if (b.gameOperationId === null) return 1;
      return (a.gameOperationName || '').localeCompare(
        b.gameOperationName || ''
      );
    });
  }

  public documentLabel(doc: LicenseDocument): string {
    return doc.document_type_name || doc.document_type;
  }

  private _resetDocumentUploadState(): void {
    this.uploadDocumentType = '';
    this.uploading = false;
    this.uploadErrors = [];
    this.uploadErrorKey = null;
    this.confirmDeleteDocumentId = null;
  }

  public loadAvailableDocumentTypes(): void {
    if (!this.player?.id) return;

    this.documentTypesFailed = false;
    this._playerService
      .getAvailableDocumentTypes(this.player.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.availableDocumentTypes = result;
          this._cdr.markForCheck();
        },
        // Ohne Auswahlliste kein Upload. Das muss dastehen, sonst sieht der
        // Bereich aus wie einer, in dem es nichts hochzuladen gibt.
        error: () => {
          this.availableDocumentTypes = [];
          this.documentTypesFailed = true;
          this._cdr.markForCheck();
        },
      });
  }

  // Vorhandenes Dokument der gewählten Art: Ein neuer Upload ersetzt es (die API
  // löscht die Vorgänger derselben Art), das muss vorher sichtbar sein.
  public get documentToBeReplaced(): LicenseDocument | undefined {
    if (!this.uploadDocumentType) return undefined;

    return this.licenseDocuments.find(
      (doc) => doc.document_type === this.uploadDocumentType
    );
  }

  public onDocumentFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.player?.id || !this.uploadDocumentType) return;

    this.uploadErrors = [];
    this.uploadErrorKey = null;

    // Gleiche Grenze wie serverseitig (LicenseDocument::MAX_FILE_SIZE), damit
    // eine zu große Datei nicht erst nach dem Hochladen abgewiesen wird.
    if (file.size > PlayerEditComponent.MAX_DOCUMENT_SIZE) {
      this.uploadErrorKey = 'playerAdmin.edit.documentTooLarge';
      input.value = '';
      this._cdr.markForCheck();
      return;
    }

    this.uploading = true;
    this._playerService
      .uploadLicenseDocument(this.player.id, this.uploadDocumentType, file)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          input.value = '';
          this.uploading = false;
          this.uploadDocumentType = '';
          this.loadLicenseDocuments();
          this._notificationService.success('Dokument wurde hochgeladen.', {
            autoClose: true,
            keepAfterRouteChange: false,
          });
          this._cdr.markForCheck();
        },
        error: (err) => {
          input.value = '';
          this.uploading = false;
          this.uploadErrors = err?.error?.errors ?? [];
          if (!this.uploadErrors.length) {
            this.uploadErrorKey = 'playerAdmin.edit.documentUploadFailed';
          }
          this._cdr.markForCheck();
        },
      });
  }

  public deleteDocument(documentId: number): void {
    if (!this.player?.id) return;

    this.uploadErrors = [];
    this.uploadErrorKey = null;
    this._playerService
      .deleteLicenseDocument(this.player.id, documentId)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.confirmDeleteDocumentId = null;
          this.loadLicenseDocuments();
          this._notificationService.success('Dokument wurde gelöscht.', {
            autoClose: true,
            keepAfterRouteChange: false,
          });
          this._cdr.markForCheck();
        },
        error: () => {
          this.confirmDeleteDocumentId = null;
          this.uploadErrorKey = 'playerAdmin.edit.documentDeleteFailed';
          this._cdr.markForCheck();
        },
      });
  }

  public loadSuspensions(): void {
    if (!this.player?.id || !this.can('player_suspend')) return;

    this._playerService.getSuspensions(this.player.id).subscribe({
      next: (result) => {
        this.suspensions = result;
        this._cdr.markForCheck();
      },
    });
  }

  public additionalClubs() {
    return this.player?.clubs?.filter((club) => !club.home_club) || [];
  }

  public homeClubs() {
    return this.player?.clubs?.filter((club) => club.home_club) || [];
  }

  public getNations(): void {
    this._playerService.getNations().subscribe({
      next: (result) => {
        this.nations = result;

        this._cdr.markForCheck();
      },
    });
  }

  public getAllClubs(): void {
    this._clubService.getAdminClubAll().subscribe({
      next: (result) => {
        this.allClubs = result.sort((a, b) => {
          if (a.name <= b.name) {
            return -1;
          }
          if (a.name > b.name) {
            return 1;
          }

          return 0;
        });
        this._refreshAssignableClubs();

        this._cdr.markForCheck();
      },
    });
  }

  /**
   * Auswahl der Karte „Zusatzverein hinzufügen". Ein deaktivierter Verein nimmt
   * keine Spieler mehr auf und steht deshalb nicht zur Wahl (fe#318); die volle
   * Liste bleibt in `allClubs`, denn `getClubNameById()` benennt damit die
   * bestehenden Zugehörigkeiten, auch die zu deaktivierten Vereinen.
   */
  private _refreshAssignableClubs(): void {
    this.assignableClubs = this.allClubs.filter(
      (club) =>
        !club.deactivated &&
        !this.isAdditionalClubActive(club.id) &&
        !this.isHomeClub(club.id)
    );
  }

  public isAdditionalClubActive(clubId: number | undefined): boolean {
    return (
      (this.player?.clubs || []).findIndex((club) => {
        const validUntil = new Date(club.valid_until || '');
        const now = new Date(Date.now());
        return club.club_id === clubId && validUntil >= now;
      }) >= 0
    );
  }

  public isHomeClub(clubId: number | undefined): boolean {
    return (
      (this.player?.clubs || []).findIndex((club) => {
        const validUntil = new Date(club.valid_until || '');
        const now = new Date(Date.now());
        return (
          club.club_id === clubId &&
          club.home_club &&
          (!club.valid_until || validUntil >= now)
        );
      }) >= 0
    );
  }

  public getClubNameById(id: number): string {
    return this.allClubs.find((club) => club.id === id)?.name || '(unbekannt)';
  }

  public newPlayer(): void {
    this.player = {
      id: 0,
      last_name: '',
      first_name: '',
      birthdate: '',
      gender: 'M',
      nation_id: 0,
      club_id: this.club_id,
    };
  }

  public getPlayersNationString(): string {
    const player = this.player;

    if (player && this.nations) {
      const foundNations = this.nations.filter(
        (n) => n.id === player.nation_id
      );
      return foundNations && foundNations.length > 0
        ? foundNations[0].name
        : '';
    }

    return '';
  }

  public get genderKeys(): GenderKey[] {
    // we need to cast the keys to GenderKey[] because Object.keys returns string[]
    return Object.keys(PLAYER_GENDERS) as GenderKey[];
  }

  public can(permissionString: string): boolean {
    let p = permissionString;

    if (p === 'player_create_update') {
      p = this.editMode ? 'update_player' : 'create_player';
    }

    return this.permissions[p] || false;
  }

  public error(player: Player): boolean {
    return this.errorMsg(player).length > 0;
  }

  public errorMsg(player: Player): string[] {
    // eslint-disable-next-line prefer-const
    let msg = [];

    if (player.first_name.length < 1) {
      msg.push('Es muss ein Vorname gesetzt werden');
    }

    if (player.last_name.length < 1) {
      msg.push('Es muss ein Nachname gesetzt werden');
    }

    if (player.birthdate.length < 1) {
      msg.push('Es muss ein Geburtsdatum gesetzt werden');
    }

    if (player.nation_id <= 0) {
      msg.push('Es muss ein Nationalität gesetzt werden');
    }

    return msg;
  }

  public submit(player: Player) {
    const isNewPlayer = player.id === 0;

    this._playerService
      .adminCreateOrUpdatePlayer({ ...player, club_id: this.club_id })
      .subscribe({
        next: () => {
          const message = [
            isNewPlayer
              ? 'Spieler erfolgreich hinzugefügt.'
              : 'Spieler erfolgreich geändert.',
          ].join('');
          this._notificationService.success(message, {
            autoClose: true,
            keepAfterRouteChange: true,
          });
          // Vereins-/Teammanager (ohne Admin/SBK-Zugriff) kommen über ihre
          // eigene Spielerliste hierher und dürfen die vereinsbezogene
          // Adminliste nicht betreten, daher zurück nach spieler-verein.
          if (this.permissions['menu_item_player_admin']) {
            this._router.navigate([
              '/',
              'verwaltung',
              'vereine',
              this.club_id,
              'spieler',
            ]);
          } else {
            this._router.navigate(['/', 'verwaltung', 'spieler-verein']);
          }
        },
        // Fehlermeldungen zeigt der globale ErrorInterceptor (#84).
      });
  }

  public addAdditionalClub(
    player: Player | undefined,
    clubId: number | string | null | undefined
  ) {
    this._playerService
      .adminAddAdditionalClub(player?.id || 0, String(clubId ?? '0'))
      .subscribe({
        next: () => {
          const message = 'Spieler wurde erfolgreich freigegeben.';
          this._notificationService.success(message, {
            autoClose: true,
            keepAfterRouteChange: true,
          });
          if (player?.id) {
            this.getPlayer(player.id.toString());
          }
        },
      });
  }

  public removeAdditionalClub(
    player: Player | undefined,
    clubId: string | undefined,
    valid_until: string | undefined
  ) {
    this._playerService
      .adminRemoveAdditionalClub(
        player?.id || 0,
        clubId || '0',
        valid_until || '0'
      )
      .subscribe({
        next: () => {
          const message = 'Spieler wurde erfolgreich freigegeben.';
          this._notificationService.success(message, {
            autoClose: true,
            keepAfterRouteChange: true,
          });
          if (player?.id) {
            this.getPlayer(player.id.toString());
          }
        },
      });
  }

  get isDeactivated(): boolean {
    return !!this.player?.deactivated_at;
  }

  get canDeactivate(): boolean {
    return (
      !this.isDeactivated && this.editMode && this.can('player_deactivate')
    );
  }

  get canReactivate(): boolean {
    return this.isDeactivated && this.editMode && this.can('player_deactivate');
  }

  public cancelDeactivate(): void {
    this.confirmDeactivate = false;
    this.deactivateReason = '';
    this.deactivateReasonOther = '';
  }

  public deactivatePlayer(): void {
    if (!this.player) return;
    const reason =
      this.deactivateReason === 'Sonstiges'
        ? `Sonstiges: ${this.deactivateReasonOther}`
        : this.deactivateReason;
    this._playerService
      .deactivatePlayer(this.player.id, reason)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.player = updated;
          this.cancelDeactivate();
          this._notificationService.success('Spieler wurde deaktiviert.', {
            autoClose: true,
            keepAfterRouteChange: false,
          });
          this._cdr.markForCheck();
        },
        error: () => {
          this.cancelDeactivate();
          this._cdr.markForCheck();
        },
      });
  }

  public reactivatePlayer(): void {
    if (!this.player) return;
    this._playerService
      .reactivatePlayer(this.player.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.player = updated;
          this._notificationService.success('Spieler wurde reaktiviert.', {
            autoClose: true,
            keepAfterRouteChange: false,
          });
          this._cdr.markForCheck();
        },
        error: () => {
          this._cdr.markForCheck();
        },
      });
  }

  public saveEmail(): void {
    if (!this.player?.id || !this.player?.email) return;
    this._playerService
      .updatePlayerEmail(this.player.id, this.player.email ?? null)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this._notificationService.success('E-Mail gespeichert.', {
            autoClose: true,
            keepAfterRouteChange: false,
          });
        },
      });
  }

  public setLicenseToTransfer(license: PlayerLicense) {
    const licenseId = license.id;

    if (this.player) {
      this._playerService
        .updateLicenseStatus(
          this.player.id,
          licenseId,
          6,
          'für Transfer ungültig gesetzt'
        )
        .subscribe({
          next: () => {
            this._notificationService.success(
              'Lizenz für Spieler ' +
                this.player?.first_name +
                ' ' +
                this.player?.last_name +
                ' (' +
                this.player?.id +
                ') für Transfer ungültig gesetzt',
              {
                autoClose: true,
                keepAfterRouteChange: false,
              }
            );
            this.getPlayer('' + this.player?.id);
          },
        });
    }
  }

  // --- Saison-gruppierte Lizenzhistorie ------------------------------------

  public seasonName(seasonId: number | string | undefined): string {
    const found = this.seasons.find((s) => String(s.id) === String(seasonId));
    return found?.name ?? `${seasonId}`;
  }

  public isCurrentSeasonLicense(license: PlayerLicense): boolean {
    return (
      this.currentSeasonId != null &&
      String(license.season_id) === String(this.currentSeasonId)
    );
  }

  // Lizenzen nach Saison gruppieren: aktuelle Saison zuerst, danach absteigend;
  // Altbestand ohne season_id (Legacy-Import) ganz zuletzt.
  public licenseSeasonGroups(): LicenseSeasonGroup[] {
    const groups = new Map<string, PlayerLicense[]>();
    for (const license of this.player?.licenses ?? []) {
      const key = license.season_id == null ? '' : String(license.season_id);
      const list = groups.get(key);
      if (list) list.push(license);
      else groups.set(key, [license]);
    }

    return [...groups.entries()]
      .map(([key, licenses]) => ({
        seasonId: key || undefined,
        name: key ? this.seasonName(key) : '',
        current: !!key && key === String(this.currentSeasonId),
        licenses,
      }))
      .sort((a, b) => {
        if (a.current !== b.current) return a.current ? -1 : 1;
        if (!a.seasonId) return 1;
        if (!b.seasonId) return -1;
        return Number(b.seasonId) - Number(a.seasonId);
      });
  }

  // --- Erst-/Zweitlizenz-Zuordnung (GF-Erwachsenenbereich) -----------------

  public isGfAdultLicense(license: PlayerLicense): boolean {
    const league = license.league;
    if (!league || league.field_size !== 'GF') return false;
    // Jugendligen (U19/U17/…) kennen keine Erst-/Zweitlizenz.
    return !/^U\d/.test(league.age_group ?? '');
  }

  public isActiveLicense(license: PlayerLicense): boolean {
    const last = license.history?.[license.history.length - 1];
    return last?.license_status_id === 1 || last?.license_status_id === 2;
  }

  // Weitere aktive Lizenzen im selben GF-Erwachsenen-Wettbewerb
  // (gleiche Saison, gleiches female-Flag der Liga).
  public gfPartnerLicenses(license: PlayerLicense): PlayerLicense[] {
    return (this.player?.licenses ?? []).filter(
      (l) =>
        l.id !== license.id &&
        String(l.season_id) === String(license.season_id) &&
        this.isActiveLicense(l) &&
        this.isGfAdultLicense(l) &&
        l.league?.female === license.league?.female
    );
  }

  public gfRoleEditable(license: PlayerLicense): boolean {
    if (!this.can('player_set_gf_role')) return false;
    if (!this.isGfAdultLicense(license) || !this.isActiveLicense(license))
      return false;
    return !!license.gf_role || this.gfPartnerLicenses(license).length > 0;
  }

  // Bereits erfolgte Täusche in diesem Wettbewerb: jeder Tausch schreibt genau
  // einen 'swap'-Eintrag auf die gewechselte Lizenz (Partner erhält 'auto'),
  // die Summe über die Wettbewerbs-Lizenzen zählt also die Tausch-Vorgänge.
  public gfSwapCount(license: PlayerLicense): number {
    return [license, ...this.gfPartnerLicenses(license)].reduce(
      (sum, l) =>
        sum +
        (l.gf_role_history ?? []).filter((h) => h.source === 'swap').length,
      0
    );
  }

  public setGfRole(license: PlayerLicense, role: GfRole | null): void {
    if (!this.player?.id) return;
    this._playerService
      .setGfLicenseRole(this.player.id, license.id, role)
      .subscribe({
        next: () => {
          this._notificationService.success(
            'Erst-/Zweitlizenz-Zuordnung aktualisiert.',
            { autoClose: true, keepAfterRouteChange: false }
          );
          this.getPlayer('' + this.player?.id);
        },
      });
  }

  public onChangeRequestTypeChange(): void {
    this.changeRequestValue = '';
    this.mergeSecondaryId = null;
    if (this.changeRequestType === 'merge') this.loadMergeClubPlayers();
  }

  public get selectedMergePlayer(): Player | undefined {
    return this.mergeClubPlayers.find((p) => p.id === this.mergeSecondaryId);
  }

  private _formatBirthdate(birthdate: string | undefined): string {
    if (!birthdate) return '';
    const [year, month, day] = birthdate.split('-');
    return day ? `${day}.${month}.${year}` : birthdate;
  }

  private loadMergeClubPlayers(): void {
    if (!this.club_id) return;

    this.mergeLoadingPlayers = true;
    this._playerService
      .vmGetPlayers(+this.club_id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (players) => {
          this.mergeClubPlayers = players.filter(
            (p) => p.id !== this.player?.id && !p.deactivated_at
          );
          this.mergePlayerOptions = this.mergeClubPlayers.map((p) => ({
            id: p.id,
            label: `${p.last_name}, ${p.first_name} (${this._formatBirthdate(
              p.birthdate
            )})`,
          }));
          this.mergeLoadingPlayers = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.mergeLoadingPlayers = false;
          this._cdr.markForCheck();
        },
      });
  }

  public submitChangeRequest(player: Player): void {
    if (this.changeRequestSubmitting) return;
    if (!this.changeRequestType || !this.club_id || !player.id) return;
    if (this.changeRequestType === 'merge' && !this.mergeSecondaryId) return;

    const value = ['names_swapped', 'merge'].includes(this.changeRequestType)
      ? undefined
      : this.changeRequestValue;
    const secondaryId =
      this.changeRequestType === 'merge' && this.mergeSecondaryId
        ? this.mergeSecondaryId
        : undefined;

    this.changeRequestSubmitting = true;
    this._changeRequestService
      .create(
        player.id,
        +this.club_id,
        this.changeRequestType,
        value,
        secondaryId
      )
      .subscribe({
        next: () => {
          this.changeRequestSubmitting = false;
          this.changeRequestSent = true;
          this.changeRequestType = '';
          this.changeRequestValue = '';
          this.mergeSecondaryId = null;
          this._cdr.markForCheck();
        },
        error: () => {
          this.changeRequestSubmitting = false;
          // Die Fehlermeldung (inkl. errors[]-Detail) zeigt der globale
          // ErrorInterceptor — hier kein eigener Toast, sonst doppelt (#84).
          this._cdr.markForCheck();
        },
      });
  }

  // --- Spielersperren (Issue #508) ---------------------------------------

  public today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  public get activeSuspensions(): PlayerSuspension[] {
    return this.suspensions.filter((s) => s.active);
  }

  public get hasApplicationBlock(): boolean {
    return this.activeSuspensions.some((s) => s.kind === 'application_block');
  }

  public isLicenseSuspended(license: PlayerLicense): boolean {
    return this.activeSuspensions.some((s) => s.team_id === license.team_id);
  }

  public openLicenseSuspend(license: PlayerLicense): void {
    this.suspendLicenseId = license.id;
    this.licenseSuspendUntil = '';
    this.licenseSuspendReason = '';
  }

  public cancelLicenseSuspend(): void {
    this.suspendLicenseId = null;
    this.licenseSuspendUntil = '';
    this.licenseSuspendReason = '';
  }

  public submitLicenseSuspend(license: PlayerLicense): void {
    if (!this.player?.id || !this.licenseSuspendUntil) return;

    this._playerService
      .createSuspension(this.player.id, {
        team_id: license.team_id,
        valid_until: this.licenseSuspendUntil,
        reason: this.licenseSuspendReason || null,
      })
      .subscribe({
        next: () => {
          this._notificationService.success('Lizenz wurde gesperrt.', {
            autoClose: true,
            keepAfterRouteChange: false,
          });
          this.cancelLicenseSuspend();
          this.getPlayer('' + this.player?.id);
        },
      });
  }

  public openApplicationBlock(): void {
    this.showApplicationBlockForm = true;
    this.blockFrom = this.today();
    this.blockUntil = '';
    this.blockReason = '';
  }

  public cancelApplicationBlock(): void {
    this.showApplicationBlockForm = false;
    this.blockFrom = '';
    this.blockUntil = '';
    this.blockReason = '';
  }

  public submitApplicationBlock(): void {
    if (!this.player?.id || !this.blockUntil) return;

    this._playerService
      .createSuspension(this.player.id, {
        team_id: null,
        valid_from: this.blockFrom || null,
        valid_until: this.blockUntil,
        reason: this.blockReason || null,
      })
      .subscribe({
        next: () => {
          this._notificationService.success(
            'Beantragungssperre wurde eingerichtet. Alle aktiven Lizenzen wurden gesperrt.',
            { autoClose: true, keepAfterRouteChange: false }
          );
          this.cancelApplicationBlock();
          this.getPlayer('' + this.player?.id);
        },
      });
  }

  public liftSuspension(suspension: PlayerSuspension): void {
    if (!this.player?.id) return;

    this._playerService
      .liftSuspension(this.player.id, suspension.id)
      .subscribe({
        next: () => {
          this._notificationService.success('Sperre wurde aufgehoben.', {
            autoClose: true,
            keepAfterRouteChange: false,
          });
          this.getPlayer('' + this.player?.id);
        },
      });
  }
}
