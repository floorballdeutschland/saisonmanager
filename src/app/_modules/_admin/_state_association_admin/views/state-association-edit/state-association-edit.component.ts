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

@Component({
  templateUrl: './state-association-edit.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class StateAssociationEditComponent implements OnInit, OnDestroy {
  stateAssociation: Partial<StateAssociation> = { name: '', short_name: '' };
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

  get parent(): StateAssociation | undefined {
    return this.allStateAssociations.find(
      (sa) => sa.id === this.stateAssociation.parent_id
    );
  }

  get rootStateAssociations(): StateAssociation[] {
    return this.allStateAssociations.filter(
      (sa) => !sa.parent_id && sa.id !== this.stateAssociation.id
    );
  }

  submit(): void {
    if (!this.stateAssociation.name?.trim()) return;

    this.saving = true;

    const payload: Partial<StateAssociation> = {
      name: this.stateAssociation.name,
      short_name: this.stateAssociation.short_name,
      parent_id: this.stateAssociation.parent_id ?? null,
      vsk_email: this.hasParent ? null : this.stateAssociation.vsk_email,
      sbk_email: this.hasParent ? null : this.stateAssociation.sbk_email,
      express_license_enabled: this.hasParent
        ? false
        : this.stateAssociation.express_license_enabled,
      scan_required: this.hasParent
        ? false
        : this.stateAssociation.scan_required,
      referee_license_review_enabled: this.hasParent
        ? false
        : (this.stateAssociation.referee_license_review_enabled ?? false),
      banner_link_url: this.stateAssociation.banner_link_url ?? null,
    };

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
      error: () => {
        this.saving = false;
        this._cdr.markForCheck();
        this._notificationService.error(
          this._transloco.translate(
            'stateAssociationAdmin.notifications.saveError'
          ),
          {
            autoClose: false,
          }
        );
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

  private readonly _allowedBannerType = 'image/webp';
  private readonly _maxBannerSize = 500 * 1024;

  onBannerSelected(input: HTMLInputElement): void {
    if (!input.files?.length || !this.stateAssociation.id) return;
    const file = input.files[0];

    if (file.type !== this._allowedBannerType) {
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

  private readonly _allowedLogoTypes = ['image/webp'];
  private readonly _maxLogoSize = 5 * 1024 * 1024;

  onLogoSelected(input: HTMLInputElement): void {
    if (!input.files?.length || !this.stateAssociation.id) return;
    const file = input.files[0];

    if (!this._allowedLogoTypes.includes(file.type)) {
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
