import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { Subject, takeUntil } from 'rxjs';
import {
  StateAssociationService,
  NotificationService,
  SessionService,
} from '@floorball/core';
import {
  ChecklistItem,
  GameOperation,
  StateAssociation,
  StateAssociationRelease,
  User,
} from '@floorball/types';
import {
  IMAGE_UPLOAD_ACCEPT,
  isAllowedImageType,
} from 'src/app/_helpers/_utils/image-upload';
import {
  GERMAN_STATES,
  GermanStateCode,
  germanStateName,
} from 'src/app/_helpers/_utils/german-states';

// Der Block „Einstellungen" der Verbandsmaske. Haengt ein uebergeordneter
// Verbund dran, kommen alle diese Werte von dort: die Maske sperrt die Felder,
// das Backend verwirft sie beim Speichern eines Kind-LV
// (StateAssociation::INHERITED_SETTINGS) und liest sie ueberall ueber die
// effective_*-Methoden. Nicht dabei sind die Postfaecher, die anders erben (ein
// eigener Eintrag am Kind-LV gewinnt) sowie Stammdaten, Zustaendigkeitsbereich,
// Logo, Banner, Spieltagscheckliste und Freigaben.
const INHERITED_SETTINGS = [
  'express_license_enabled',
  'referee_license_review_enabled',
  'scan_required',
  'referee_assignment_external_enabled',
  'referee_assignment_enabled',
  'person_level_assignment_default',
  'report_form_email_enabled',
  'manual_proceeding_creation',
  'requested_license_playable',
] as const;

type InheritedSetting = (typeof INHERITED_SETTINGS)[number];

// Zu jedem Feld der tatsaechlich greifende Wert aus dem Detail-Endpunkt.
const EFFECTIVE_SETTING: Record<InheritedSetting, keyof StateAssociation> = {
  express_license_enabled: 'effective_express_license_enabled',
  referee_license_review_enabled: 'effective_referee_license_review_enabled',
  scan_required: 'effective_scan_required',
  referee_assignment_external_enabled:
    'effective_referee_assignment_external_enabled',
  referee_assignment_enabled: 'effective_referee_assignment_enabled',
  person_level_assignment_default: 'effective_person_level_assignment_default',
  report_form_email_enabled: 'effective_report_form_email_enabled',
  manual_proceeding_creation: 'effective_manual_proceeding_creation',
  requested_license_playable: 'effective_requested_license_playable',
};

@Component({
  templateUrl: './state-association-edit.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class StateAssociationEditComponent implements OnInit, OnDestroy {
  stateAssociation: Partial<StateAssociation> = { name: '', short_name: '' };
  // Dateiauswahl-Filter für Logo und Banner, eine Quelle für Template und Prüfung.
  readonly acceptImageTypes = IMAGE_UPLOAD_ACCEPT;
  // Auswahl für den Zuständigkeitsbereich. Ohne „Sonstige": ein Verband kann
  // für Vereine mit Sitz im Ausland nicht zuständig sein, und die API weist das
  // Kürzel am Landesverband ab.
  readonly germanStates = GERMAN_STATES;
  editMode = false;
  saving = false;
  currentUser: User | null = null;

  allStateAssociations: StateAssociation[] = [];

  checklistItems: ChecklistItem[] = [];
  newQuestion = '';
  addingItem = false;
  editingItemId: number | null = null;
  editingQuestion = '';

  releases: StateAssociationRelease[] = [];

  // Gespeicherter Stand von parent_id, Referenz für showInheritedValues.
  private _persistedParentId: number | null | undefined;
  // Gespeicherter Stand von states, Referenz für inheritedStates. Aus demselben
  // Grund wie _persistedParentId: effective_states berechnet der Server aus dem
  // gespeicherten Stand, die Auswahl im Formular läuft ihm voraus.
  private _persistedStates: GermanStateCode[] = [];
  // Mögliche Empfänger-Sportverbünde (alle außer den eigenen des LV) – vom
  // dedizierten releases#candidates-Endpoint, erst im Bearbeitungsmodus geladen.
  releaseCandidates: GameOperation[] = [];
  selectedGameOperationId: number | null = null;
  addingRelease = false;

  private _destroy$ = new Subject<void>();

  constructor(
    private _stateAssociationService: StateAssociationService,
    private _notificationService: NotificationService,
    private _route: ActivatedRoute,
    private _router: Router,
    private _sessionService: SessionService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  // Das Umhängen des übergeordneten Verbands bleibt echten Admins vorbehalten
  // (Backend strippt parent_id für Nicht-Admins). Der globale SBK verwaltet zwar
  // alle LVs, aber nicht deren Lebenszyklus.
  get canManageLifecycle(): boolean {
    return !!this.currentUser?.permissions[
      'state_association_manage_lifecycle'
    ];
  }

  ngOnInit(): void {
    this._sessionService.currentUser$
      .pipe(takeUntil(this._destroy$))
      .subscribe((user) => {
        this.currentUser = user;
        this._cdr.markForCheck();
      });

    this._stateAssociationService
      .adminGetAll()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (all) => {
          this.allStateAssociations = all;
          this._cdr.markForCheck();
        },
      });

    const id = this._route.snapshot.params['id'];
    if (id) {
      this.editMode = true;
      const numericId = parseInt(id, 10);
      this._stateAssociationService
        .adminGet(numericId)
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: (sa) => {
            this.stateAssociation = { ...sa };
            this._persistedParentId = sa.parent_id ?? null;
            this._persistedStates = sa.states ?? [];
            this.checklistItems = sa.checklist_items ?? [];
            this.releases = sa.releases ?? [];
            this._cdr.markForCheck();
          },
        });

      // Freigabe-Empfänger: alle Sportverbünde außer den eigenen dieses LV.
      this._stateAssociationService
        .adminGetReleaseCandidates(numericId)
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: (gos) => {
            this.releaseCandidates = gos;
            this._cdr.markForCheck();
          },
        });
    }
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  get hasParent(): boolean {
    return !!this.stateAssociation.parent_id;
  }

  get hasChildren(): boolean {
    return !!this.stateAssociation.children?.length;
  }

  // Zuständigkeitsbereich: eigene Auswahl. Beim Neuanlegen gibt es noch kein
  // `states`, deshalb gegen [] absichern.
  isStateSelected(isocode: GermanStateCode): boolean {
    return (this.stateAssociation.states ?? []).includes(isocode);
  }

  toggleState(isocode: GermanStateCode): void {
    const selected = new Set(this.stateAssociation.states ?? []);
    if (selected.has(isocode)) {
      selected.delete(isocode);
    } else {
      selected.add(isocode);
    }
    // Sortiert, damit die Anzeige nicht von der Klickreihenfolge abhängt. Die
    // API sortiert beim Speichern ohnehin.
    this.stateAssociation.states = [...selected].sort();
  }

  // Bundesländer, die dieser Verband nur über seine untergeordneten Verbände
  // betreut. Bei einem Spielverbund ist das üblicherweise der gesamte Bereich,
  // weil er selbst nichts einträgt.
  //
  // Aus effective_states abgeleitet und nicht aus children: der Detail-Datensatz
  // liefert die Kinder als short_hash, und darin steht kein states.
  //
  // Abgezogen wird der *gespeicherte* Stand, nicht die laufende Auswahl. Beides
  // muss zusammenpassen, weil effective_states ein Serverwert zum gespeicherten
  // Stand ist: Nimmt man den Haken bei einem eigenen Bundesland weg, rutschte es
  // sonst in die geerbten, und die Maske behauptete, es käme über einen
  // untergeordneten Verband. Dieselbe Vorkehrung wie _persistedParentId bei den
  // geerbten Postfächern.
  get inheritedStates(): GermanStateCode[] {
    const persisted = new Set(this._persistedStates);
    return (this.stateAssociation.effective_states ?? []).filter(
      (code) => !persisted.has(code)
    );
  }

  get inheritedStateNames(): string {
    return this.inheritedStates.map((code) => germanStateName(code)).join(', ');
  }

  // Klartext für die Nur-Lese-Ansicht der SBK: der ganze greifende Bereich,
  // eigener und geerbter zusammen.
  get effectiveStateNames(): string {
    return (this.stateAssociation.effective_states ?? [])
      .map((code) => germanStateName(code))
      .join(', ');
  }

  // Die effective_*-Werte berechnet der Server aus dem *gespeicherten*
  // parent_id. Das Dropdown lässt sich aber sofort umstellen, deshalb geerbte
  // Werte nur zeigen, solange die Auswahl dem gespeicherten Stand entspricht.
  // Sonst stünde der Wert des alten Verbunds unter dem Namen des neuen, beim
  // Neuanlegen gar keiner.
  get showInheritedValues(): boolean {
    return (
      this.hasParent &&
      this.stateAssociation.parent_id === this._persistedParentId
    );
  }

  get inheritedPending(): boolean {
    return this.hasParent && !this.showInheritedValues;
  }

  // Platzhalter der drei Postfach-Felder: eigener Hinweistext ohne Verbund,
  // sonst der geerbte Wert. Solange die Verbundsauswahl noch nicht gespeichert
  // ist, bleibt er leer statt „nicht gesetzt" zu behaupten.
  mailboxPlaceholder(field: 'vsk' | 'sbk' | 'rsk'): string {
    if (!this.hasParent) {
      return this._transloco.translate(
        `stateAssociationAdmin.edit.${field}EmailPlaceholder`
      );
    }
    if (!this.showInheritedValues) return '';

    return (
      this._effectiveMailbox(field) ||
      this._transloco.translate(
        'stateAssociationAdmin.edit.inheritedPlaceholder'
      )
    );
  }

  private _effectiveMailbox(field: 'vsk' | 'sbk' | 'rsk'): string | null {
    switch (field) {
      case 'vsk':
        return this.stateAssociation.effective_vsk_email ?? null;
      case 'sbk':
        return this.stateAssociation.effective_sbk_email ?? null;
      default:
        return this.stateAssociation.effective_rsk_email ?? null;
    }
  }

  // Kein parent-Getter mehr: Der Listen-Endpunkt liefert nur short_hash (ohne
  // Postfächer und Flags) und für einen regionalen SBK ohnehin nur die eigenen
  // Landesverbände, nicht den übergeordneten Verbund. Name und geerbte Werte
  // kommen deshalb aus dem Detail-Datensatz (parent_name, effective_*).
  get rootStateAssociations(): StateAssociation[] {
    return this.allStateAssociations.filter(
      (sa) => !sa.parent_id && sa.id !== this.stateAssociation.id
    );
  }

  // Anzeigewert eines Hakens aus dem Block „Einstellungen".
  //
  // Bei gesetztem Verbund steht hier der geerbte Wert und nicht der eigene: Das
  // Feld ist gesperrt, gelesen wird der eigene Stand nirgends mehr, und ihn
  // anzuzeigen wäre eine Falschaussage darüber, was für diesen Verband gilt.
  //
  // Solange die Verbundsauswahl noch nicht gespeichert ist, gehören die
  // effective_*-Werte noch zum alten Verbund (showInheritedValues ist dann
  // false, siehe dort). Dann bleibt der eigene Stand stehen, und die Maske sagt
  // darunter, dass der geerbte Wert erst nach dem Speichern feststeht.
  setting(key: InheritedSetting): boolean {
    const value = this.showInheritedValues
      ? (this.stateAssociation[EFFECTIVE_SETTING[key]] as boolean | undefined)
      : this.stateAssociation[key];
    return value ?? false;
  }

  setSetting(key: InheritedSetting, value: boolean): void {
    this.stateAssociation[key] = value;
  }

  // Der übergeordnete Verbund wurde im Dropdown geändert.
  //
  // Wird er gelöst, übernimmt der Landesverband die Werte, die bis eben für ihn
  // galten. Sonst stünde im Formular wieder sein eigener gespeicherter Stand,
  // und der ist bei jedem Verband, der nie ohne Verbund war, durchgehend „aus":
  // Das Lösen schaltete dann in derselben Speicherung den Berichtsworkflow, den
  // Ansetzungsweg und alles Übrige ab, ohne dass irgendwo etwas davon steht.
  //
  // Übernommen wird vor dem Speichern, damit die Haken es sofort zeigen und
  // korrigierbar bleiben, statt es dem Speichern zu überlassen.
  onParentChanged(): void {
    if (this.hasParent) return;

    for (const key of INHERITED_SETTINGS) {
      this.stateAssociation[key] =
        (this.stateAssociation[EFFECTIVE_SETTING[key]] as
          | boolean
          | undefined) ?? false;
    }
  }

  // Die drei Ansetzungs-Optionen sind gestaffelt: die Personenebene setzt den
  // Hauptschalter voraus, die Voreinstellung die Personenebene. Statt nur das
  // Eingabefeld auszugrauen, wird der Wert selbst durchgereicht – sonst bliebe
  // eine abgehakte untere Option im Modell stehen und tauchte beim erneuten
  // Einschalten der oberen unerwartet aktiv wieder auf.
  //
  // Die Staffelung gilt auch für die geerbten Werte: Das Backend wertet die drei
  // Schalter ausschließlich in StateAssociation#referee_assignment_mode aus, und
  // dort setzt jede Stufe die darüberliegende voraus.
  get refereeAssignmentExternal(): boolean {
    return this.setting('referee_assignment_external_enabled');
  }

  set refereeAssignmentExternal(value: boolean) {
    this.setSetting('referee_assignment_external_enabled', value);
    if (!value) {
      this.setSetting('referee_assignment_enabled', false);
      this.setSetting('person_level_assignment_default', false);
    }
  }

  get refereeAssignmentPersonLevel(): boolean {
    return (
      this.refereeAssignmentExternal &&
      this.setting('referee_assignment_enabled')
    );
  }

  set refereeAssignmentPersonLevel(value: boolean) {
    this.setSetting('referee_assignment_enabled', value);
    if (!value) this.setSetting('person_level_assignment_default', false);
  }

  get personLevelAssignmentDefault(): boolean {
    return (
      this.refereeAssignmentPersonLevel &&
      this.setting('person_level_assignment_default')
    );
  }

  set personLevelAssignmentDefault(value: boolean) {
    this.setSetting('person_level_assignment_default', value);
  }

  submit(): void {
    if (!this.stateAssociation.name?.trim()) return;

    this.saving = true;

    // Wurde der Verbund gerade gelöst, übernimmt der Landesverband die bis eben
    // geltenden Werte. Das Dropdown macht das schon beim Umstellen; hier steht
    // es noch einmal für Wege, die es nicht anfassen.
    if (!this.hasParent && this._persistedParentId) this.onParentChanged();

    const payload: Partial<StateAssociation> = {
      name: this.stateAssociation.name,
      short_name: this.stateAssociation.short_name,
      parent_id: this.stateAssociation.parent_id ?? null,
      // Zuständigkeitsbereich, immer mitgesendet, damit der Payload nicht von der
      // Rolle abhängt. Für einen regionalen SBK ist das Feld unsichtbar und der
      // Server strippt es beim permit; das Mitsenden ist dort also folgenlos.
      // Anders als bei express_license_enabled unten, wo der Server das Feld
      // gerade nicht strippt und der geladene Wert deshalb mit muss.
      states: this.stateAssociation.states ?? [],
      vsk_email: this.hasParent ? null : this.stateAssociation.vsk_email,
      sbk_email: this.hasParent ? null : this.stateAssociation.sbk_email,
      rsk_email: this.hasParent ? null : this.stateAssociation.rsk_email,
      banner_link_url: this.stateAssociation.banner_link_url ?? null,
    };

    // Der Block „Einstellungen" wird nur ohne übergeordneten Verbund gesendet.
    // Mit Verbund gehören diese Werte dorthin: die Maske zeigt sie gesperrt und
    // geerbt, und das Backend verwirft sie am Kind-LV ohnehin. Nichts zu senden
    // lässt den gespeicherten Stand unangetastet, sodass ein später gelöster
    // Verbund die früher gepflegten eigenen Werte wieder freigibt, statt einen
    // stillschweigend überschriebenen Stand zu hinterlassen.
    //
    // Die drei Ansetzungs-Optionen kommen aus ihren Gettern, damit die
    // Staffelung schon im Payload steht; der Server räumt widersprüchliche
    // Kombinationen zusätzlich auf.
    if (!this.hasParent) {
      Object.assign(payload, {
        express_license_enabled: this.setting('express_license_enabled'),
        referee_license_review_enabled: this.setting(
          'referee_license_review_enabled'
        ),
        scan_required: this.setting('scan_required'),
        referee_assignment_external_enabled: this.refereeAssignmentExternal,
        referee_assignment_enabled: this.refereeAssignmentPersonLevel,
        person_level_assignment_default: this.personLevelAssignmentDefault,
        report_form_email_enabled: this.setting('report_form_email_enabled'),
        manual_proceeding_creation: this.setting('manual_proceeding_creation'),
      });
    }

    const call =
      this.editMode && this.stateAssociation.id
        ? this._stateAssociationService.adminUpdate(
            this.stateAssociation.id,
            payload
          )
        : this._stateAssociationService.adminCreate(payload);

    call.pipe(takeUntil(this._destroy$)).subscribe({
      next: () => {
        this._notificationService.success(
          this._transloco.translate(
            this.editMode
              ? 'stateAssociationAdmin.notifications.saved'
              : 'stateAssociationAdmin.notifications.created'
          ),
          { autoClose: true, keepAfterRouteChange: true }
        );
        this._router.navigate(['/', 'verwaltung', 'landesverbaende']);
      },
      // Ohne eigene Meldung: Das übernimmt der ErrorInterceptor, und zwar für
      // jeden Status (4xx mit dem Klartext aus `errors`, 5xx, und auch ohne
      // Verbindung). Ein zusätzlicher Toast wäre immer eine Dublette — beide
      // schließen nicht selbst, und ein fehlgeschlagenes Speichern navigiert
      // nicht, sodass sie sich mit jedem Versuch stapeln. Ab #228 verlassen
      // sich die Komponenten hier auf den Interceptor.
      error: () => {
        this.saving = false;
        this._cdr.markForCheck();
      },
    });
  }

  addChecklistItem(): void {
    if (!this.newQuestion.trim() || !this.stateAssociation.id) return;
    this.addingItem = true;
    const position = this.checklistItems.length;
    this._stateAssociationService
      .adminCreateChecklistItem(this.stateAssociation.id, {
        question: this.newQuestion.trim(),
        position,
      })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (item) => {
          this.checklistItems = [...this.checklistItems, item];
          this.newQuestion = '';
          this.addingItem = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.addingItem = false;
          this._cdr.markForCheck();
        },
      });
  }

  startEdit(item: ChecklistItem): void {
    this.editingItemId = item.id;
    this.editingQuestion = item.question;
  }

  saveEdit(item: ChecklistItem): void {
    if (!this.editingQuestion.trim() || !this.stateAssociation.id) return;
    this._stateAssociationService
      .adminUpdateChecklistItem(this.stateAssociation.id, item.id, {
        question: this.editingQuestion.trim(),
      })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.checklistItems = this.checklistItems.map((i) =>
            i.id === updated.id ? updated : i
          );
          this.editingItemId = null;
          this._cdr.markForCheck();
        },
      });
  }

  cancelEdit(): void {
    this.editingItemId = null;
  }

  deleteChecklistItem(itemId: number): void {
    if (!this.stateAssociation.id) return;
    this._stateAssociationService
      .adminDeleteChecklistItem(this.stateAssociation.id, itemId)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.checklistItems = this.checklistItems.filter(
            (i) => i.id !== itemId
          );
          this._cdr.markForCheck();
        },
      });
  }

  // Den Abschnitt „Spielbetrieb" sehen nur bundesweite Admins. Der globale SBK
  // darf diese Maske oeffnen, aber am Spielbetrieb haengen zwei Felder, die
  // Rechte verschieben (`state_association_id`, `national`) -- die API antwortet
  // ihm auf jeden Zugriff mit 403. Deshalb hier gar nicht erst anzeigen: Der
  // ErrorInterceptor wuerde ihn sonst aus der Verbandsmaske werfen.
  get canManageGameOperation(): boolean {
    return !!this.currentUser?.permissions['menu_item_game_operation_admin'];
  }

  get availableGameOperations(): GameOperation[] {
    const usedIds = new Set(
      this.releases.map((r) => r.recipient_game_operation_id)
    );
    return this.releaseCandidates.filter((go) => !usedIds.has(go.id));
  }

  addRelease(): void {
    if (!this.selectedGameOperationId || !this.stateAssociation.id) return;
    this.addingRelease = true;
    this._stateAssociationService
      .adminCreateRelease(
        this.stateAssociation.id,
        this.selectedGameOperationId
      )
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (release) => {
          this.releases = [...this.releases, release];
          this.selectedGameOperationId = null;
          this.addingRelease = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.addingRelease = false;
          this._cdr.markForCheck();
          this._notificationService.error(
            this._transloco.translate(
              'stateAssociationAdmin.notifications.releaseAddError'
            ),
            { autoClose: false }
          );
        },
      });
  }

  deletingBanner = false;

  private readonly _maxBannerSize = 500 * 1024;

  onBannerSelected(input: HTMLInputElement): void {
    if (!input.files?.length || !this.stateAssociation.id) return;
    const file = input.files[0];

    if (!isAllowedImageType(file)) {
      this._notificationService.error(
        this._transloco.translate(
          'stateAssociationAdmin.notifications.bannerTypeError'
        ),
        {
          autoClose: false,
        }
      );
      input.value = '';
      return;
    }
    if (file.size > this._maxBannerSize) {
      this._notificationService.error(
        this._transloco.translate(
          'stateAssociationAdmin.notifications.bannerSizeError'
        ),
        {
          autoClose: false,
        }
      );
      input.value = '';
      return;
    }

    this._stateAssociationService
      .adminUploadBanner(this.stateAssociation.id, file)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          input.value = '';
          this.stateAssociation.banner_url = result.banner_url;
          this._notificationService.success(
            this._transloco.translate(
              'stateAssociationAdmin.notifications.bannerUploaded'
            ),
            {
              autoClose: true,
            }
          );
          this._cdr.markForCheck();
        },
        error: (err) => {
          input.value = '';
          const msg: string =
            err?.error?.message ??
            this._transloco.translate(
              'stateAssociationAdmin.notifications.bannerUploadError'
            );
          this._notificationService.error(msg, { autoClose: false });
        },
      });
  }

  deleteBanner(): void {
    if (!this.stateAssociation.id || this.deletingBanner) return;
    if (
      !confirm(
        this._transloco.translate(
          'stateAssociationAdmin.notifications.confirmDeleteBanner'
        )
      )
    )
      return;
    this.deletingBanner = true;
    this._stateAssociationService
      .adminDeleteBanner(this.stateAssociation.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.stateAssociation.banner_url = null;
          this.deletingBanner = false;
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.deletingBanner = false;
          const msg: string =
            err?.error?.message ??
            this._transloco.translate(
              'stateAssociationAdmin.notifications.bannerDeleteError'
            );
          this._notificationService.error(msg, { autoClose: false });
          this._cdr.markForCheck();
        },
      });
  }

  private readonly _maxLogoSize = 5 * 1024 * 1024;

  onLogoSelected(input: HTMLInputElement): void {
    if (!input.files?.length || !this.stateAssociation.id) return;
    const file = input.files[0];

    if (!isAllowedImageType(file)) {
      this._notificationService.error(
        this._transloco.translate(
          'stateAssociationAdmin.notifications.logoTypeError'
        ),
        {
          autoClose: false,
        }
      );
      input.value = '';
      return;
    }
    if (file.size > this._maxLogoSize) {
      this._notificationService.error(
        this._transloco.translate(
          'stateAssociationAdmin.notifications.logoSizeError'
        ),
        {
          autoClose: false,
        }
      );
      input.value = '';
      return;
    }

    this._stateAssociationService
      .adminUploadLogo(this.stateAssociation.id, file)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          input.value = '';
          this.stateAssociation.logo_url = result.logo_url;
          this._notificationService.success(
            this._transloco.translate(
              'stateAssociationAdmin.notifications.logoUploaded'
            ),
            {
              autoClose: true,
            }
          );
          this._cdr.markForCheck();
        },
        error: (err) => {
          input.value = '';
          const msg =
            err?.error?.message ??
            this._transloco.translate(
              'stateAssociationAdmin.notifications.logoUploadError'
            );
          this._notificationService.error(msg, {
            autoClose: false,
          });
        },
      });
  }

  deleteRelease(releaseId: number): void {
    if (!this.stateAssociation.id) return;
    this._stateAssociationService
      .adminDeleteRelease(this.stateAssociation.id, releaseId)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.releases = this.releases.filter((r) => r.id !== releaseId);
          this._cdr.markForCheck();
        },
        error: () => {
          this._cdr.markForCheck();
          this._notificationService.error(
            this._transloco.translate(
              'stateAssociationAdmin.notifications.releaseDeleteError'
            ),
            { autoClose: false }
          );
        },
      });
  }
}
