import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import {
  AssociationService,
  DocumentTypeService,
  InfoLinkService,
  LeagueService,
  NotificationService,
  SessionService,
} from '@floorball/core';
import {
  DocumentType,
  GameOperationWithLeagues,
  InfoLink,
  User,
} from '@floorball/types';
import { TranslocoService } from '@jsverse/transloco';

// Zentraler Katalog der Dokumentarten für Lizenz-Pflichtdokumente.
// Admin (und globale SBK) pflegen globale + verbandsspezifische Einträge;
// verbands-gescopte SBK nur die des eigenen Verbands (die API weist deren
// Spielbetrieb automatisch zu, daher ist die Verband-Auswahl dort versteckt).
@Component({
  templateUrl: './document-type-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class DocumentTypeIndexComponent implements OnInit, OnDestroy {
  documentTypes: DocumentType[] = [];
  permittedGameOperations: GameOperationWithLeagues[] = [];
  currentUser: User | null = null;

  loading = false;
  loadFailed = false;
  saving = false;

  editingId: number | null = null;
  editBuffer: Partial<DocumentType> = {};
  editTemplateFile: File | null = null;
  editRemoveTemplate = false;

  showNewForm = false;
  newType: Partial<DocumentType> = this._emptyType();
  newTemplateFile: File | null = null;

  // Links auf externe Informationsblätter (floorball.de). Der Katalog der Keys
  // ist fest (jeder Key hat eine Stelle im Programm, die ihn anzeigt); gepflegt
  // wird nur die Adresse, weil floorball.de Dateien verschiebt.
  infoLinks: InfoLink[] = [];
  infoLinksLoadFailed = false;
  editingInfoLinkKey: string | null = null;
  infoLinkBuffer = '';
  savingInfoLink = false;

  private _destroy$ = new Subject<void>();

  constructor(
    private _associationService: AssociationService,
    private _documentTypeService: DocumentTypeService,
    private _infoLinkService: InfoLinkService,
    private _leagueService: LeagueService,
    private _sessionService: SessionService,
    private _notificationService: NotificationService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  // Anlegen/Ändern/Löschen dürfen nur Admin und die bundesweite SBK (SBK FD) –
  // gleiche Semantik wie serverseitig (authorize_manage!). Verbands-gescopte SBK
  // haben nur Lesezugriff; neue Dokumentarten beantragen sie bei sbk@floorball.de.
  get canManage(): boolean {
    return !!this.currentUser?.permissions['menu_item_state_association_admin'];
  }

  // Wer pflegen darf, darf auch den Verband frei wählen (inkl. global/bundesweit).
  get canChooseGameOperation(): boolean {
    return this.canManage;
  }

  ngOnInit(): void {
    this._sessionService.currentUser$
      .pipe(takeUntil(this._destroy$))
      .subscribe((user) => {
        this.currentUser = user;
        this._cdr.markForCheck();
      });

    this._leagueService
      .getAdminLeagues()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.permittedGameOperations = result;
          this._cdr.markForCheck();
        },
      });

    this.load();
    this.loadInfoLinks();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  load(): void {
    this.loading = true;
    this.loadFailed = false;
    this._documentTypeService
      .adminGetDocumentTypes()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.documentTypes = result;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          // Ein Ladefehler darf nicht wie ein leerer Katalog aussehen.
          // Die Fehlermeldung zeigt der globale ErrorInterceptor (#84).
          this.loading = false;
          this.loadFailed = true;
          this._cdr.markForCheck();
        },
      });
  }

  loadInfoLinks(): void {
    this.infoLinksLoadFailed = false;
    this._infoLinkService
      .adminGetInfoLinks()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.infoLinks = result;
          this._cdr.markForCheck();
        },
        error: () => {
          // Ein Ladefehler darf nicht wie „kein Link gepflegt" aussehen.
          this.infoLinksLoadFailed = true;
          this._cdr.markForCheck();
        },
      });
  }

  // Der Key ist technisch; die Bezeichnung steht in der Sprachdatei. Fehlt sie
  // (neuer Key, Sprachdatei noch nicht nachgezogen), bleibt der Key sichtbar,
  // damit die Zeile nicht namenlos wird.
  infoLinkLabel(key: string): string {
    const translated = this._transloco.translate(
      `documentTypeAdmin.index.infoLinks.${key}`
    );
    return translated === `documentTypeAdmin.index.infoLinks.${key}`
      ? key
      : translated;
  }

  startEditInfoLink(link: InfoLink): void {
    this.editingInfoLinkKey = link.key;
    this.infoLinkBuffer = link.url ?? '';
  }

  cancelEditInfoLink(): void {
    this.editingInfoLinkKey = null;
    this.infoLinkBuffer = '';
  }

  saveInfoLink(): void {
    if (!this.editingInfoLinkKey) return;
    const key = this.editingInfoLinkKey;
    this.savingInfoLink = true;
    this._infoLinkService
      .adminUpdateInfoLink(key, this.infoLinkBuffer.trim())
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.infoLinks = this.infoLinks.map((l) =>
            l.key === updated.key ? updated : l
          );
          // init wird nur beim Seitenaufbau geladen. Ohne das hier zeigte der
          // Lizenzantrag nach dem Korrigieren weiter die alte Adresse – also
          // genau dann, wenn jemand die Korrektur nachprüfen will.
          this._associationService.setInfoLink(updated.key, updated.url);
          this.cancelEditInfoLink();
          this.savingInfoLink = false;
          this._notificationService.success(
            this._transloco.translate('documentTypeAdmin.index.saved'),
            { autoClose: true, keepAfterRouteChange: false }
          );
          this._cdr.markForCheck();
        },
        error: () => {
          this.savingInfoLink = false;
          this._cdr.markForCheck();
        },
      });
  }

  gameOperationName(goId: number | null): string {
    if (goId === null || goId === undefined) {
      return this._transloco.translate('documentTypeAdmin.index.scopeGlobal');
    }
    return (
      this.permittedGameOperations.find((go) => go.id === goId)?.name ??
      String(goId)
    );
  }

  validityLabel(validity: DocumentType['validity']): string {
    return this._transloco.translate(
      validity === 'per_season'
        ? 'documentTypeAdmin.index.validityPerSeason'
        : 'documentTypeAdmin.index.validityOnce'
    );
  }

  onNewTemplateSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.newTemplateFile = input.files?.[0] ?? null;
  }

  onEditTemplateSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.editTemplateFile = input.files?.[0] ?? null;
    if (this.editTemplateFile) {
      this.editRemoveTemplate = false;
    }
  }

  startEdit(documentType: DocumentType): void {
    this.editingId = documentType.id;
    this.editBuffer = { ...documentType };
    this.editTemplateFile = null;
    this.editRemoveTemplate = false;
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editBuffer = {};
    this.editTemplateFile = null;
    this.editRemoveTemplate = false;
  }

  saveEdit(): void {
    if (!this.editingId || !this.editBuffer.name?.trim()) return;
    this.saving = true;
    this._documentTypeService
      .adminUpdateDocumentType(
        this.editingId,
        this._payload(this.editBuffer),
        this.editTemplateFile ?? undefined,
        this.editRemoveTemplate
      )
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          // usage_count/league_count liefert nur der Index-Endpoint – die
          // bekannten Werte der Zeile beibehalten.
          this.documentTypes = this.documentTypes.map((t) =>
            t.id === updated.id
              ? {
                  ...updated,
                  usage_count: t.usage_count,
                  league_count: t.league_count,
                }
              : t
          );
          this.cancelEdit();
          this.saving = false;
          this._notificationService.success(
            this._transloco.translate('documentTypeAdmin.index.saved'),
            { autoClose: true, keepAfterRouteChange: false }
          );
          this._cdr.markForCheck();
        },
        error: () => {
          this.saving = false;
          this._cdr.markForCheck();
        },
      });
  }

  create(): void {
    if (!this.newType.name?.trim()) return;
    this.saving = true;
    this._documentTypeService
      .adminCreateDocumentType(
        this._payload(this.newType),
        this.newTemplateFile ?? undefined
      )
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.newType = this._emptyType();
          this.newTemplateFile = null;
          this.showNewForm = false;
          this.saving = false;
          this._notificationService.success(
            this._transloco.translate('documentTypeAdmin.index.created'),
            { autoClose: true, keepAfterRouteChange: false }
          );
          // Neu laden, damit usage_count/league_count gefüllt sind.
          this.load();
        },
        error: () => {
          this.saving = false;
          this._cdr.markForCheck();
        },
      });
  }

  cancelNew(): void {
    this.showNewForm = false;
    this.newType = this._emptyType();
    this.newTemplateFile = null;
  }

  delete(documentType: DocumentType): void {
    if (
      !confirm(
        this._transloco.translate('documentTypeAdmin.index.deleteConfirm', {
          name: documentType.name,
        })
      )
    ) {
      return;
    }
    this._documentTypeService
      .adminDeleteDocumentType(documentType.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.documentTypes = this.documentTypes.filter(
            (t) => t.id !== documentType.id
          );
          this._notificationService.success(
            this._transloco.translate('documentTypeAdmin.index.deleted'),
            { autoClose: true, keepAfterRouteChange: false }
          );
          this._cdr.markForCheck();
        },
        error: () => {
          this._cdr.markForCheck();
        },
      });
  }

  private _emptyType(): Partial<DocumentType> {
    return {
      validity: 'once',
      game_operation_id: null,
      required_below_age: null,
      description: null,
    };
  }

  private _payload(data: Partial<DocumentType>): Partial<DocumentType> {
    const payload: Partial<DocumentType> = {
      name: data.name?.trim(),
      description: data.description ?? null,
      validity: data.validity,
      required_below_age: data.required_below_age ?? null,
    };
    if (this.canChooseGameOperation) {
      payload.game_operation_id = data.game_operation_id ?? null;
    }
    return payload;
  }
}
