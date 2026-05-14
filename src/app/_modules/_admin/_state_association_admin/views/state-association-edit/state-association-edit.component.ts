import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import {
  StateAssociationService,
  NotificationService,
  GameOperationService,
} from '@floorball/core';
import {
  ChecklistItem,
  GameOperation,
  StateAssociation,
  StateAssociationRelease,
} from '@floorball/types';

@Component({
  templateUrl: './state-association-edit.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StateAssociationEditComponent implements OnInit, OnDestroy {
  stateAssociation: Partial<StateAssociation> = { name: '', short_name: '' };
  editMode = false;
  saving = false;

  allStateAssociations: StateAssociation[] = [];

  checklistItems: ChecklistItem[] = [];
  newQuestion = '';
  addingItem = false;
  editingItemId: number | null = null;
  editingQuestion = '';

  releases: StateAssociationRelease[] = [];
  allGameOperations: GameOperation[] = [];
  selectedGameOperationId: number | null = null;
  addingRelease = false;

  private _destroy$ = new Subject<void>();

  constructor(
    private _stateAssociationService: StateAssociationService,
    private _gameOperationService: GameOperationService,
    private _notificationService: NotificationService,
    private _route: ActivatedRoute,
    private _router: Router,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._stateAssociationService
      .adminGetAll()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (all) => {
          this.allStateAssociations = all;
          this._cdr.markForCheck();
        },
      });

    this._gameOperationService
      .getAdminGameOperations()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (gos) => {
          this.allGameOperations = gos;
          this._cdr.markForCheck();
        },
      });

    const id = this._route.snapshot.params['id'];
    if (id) {
      this.editMode = true;
      this._stateAssociationService
        .adminGet(parseInt(id, 10))
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: (sa) => {
            this.stateAssociation = { ...sa };
            this.checklistItems = sa.checklist_items ?? [];
            this.releases = sa.releases ?? [];
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
          this.editMode
            ? 'Landesverband gespeichert.'
            : 'Landesverband angelegt.',
          { autoClose: true, keepAfterRouteChange: true }
        );
        this._router.navigate(['/', 'verwaltung', 'landesverbaende']);
      },
      error: () => {
        this.saving = false;
        this._cdr.markForCheck();
        this._notificationService.error('Fehler beim Speichern.', {
          autoClose: false,
        });
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
    return this.allGameOperations.filter((go) => !usedIds.has(go.id));
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
            'Freigabe konnte nicht erteilt werden.',
            { autoClose: false }
          );
        },
      });
  }

  private readonly _allowedLogoTypes = [
    'image/png',
    'image/jpeg',
    'image/svg+xml',
  ];
  private readonly _maxLogoSize = 5 * 1024 * 1024;

  onLogoSelected(input: HTMLInputElement): void {
    if (!input.files?.length || !this.stateAssociation.id) return;
    const file = input.files[0];

    if (!this._allowedLogoTypes.includes(file.type)) {
      this._notificationService.error('Nur PNG, JPG oder SVG erlaubt.', {
        autoClose: false,
      });
      input.value = '';
      return;
    }
    if (file.size > this._maxLogoSize) {
      this._notificationService.error('Datei zu groß (max. 5 MB).', {
        autoClose: false,
      });
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
          this._notificationService.success('Logo erfolgreich hochgeladen.', {
            autoClose: true,
          });
          this._cdr.markForCheck();
        },
        error: () => {
          input.value = '';
          this._notificationService.error('Logo-Upload fehlgeschlagen.', {
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
            'Freigabe konnte nicht entfernt werden.',
            { autoClose: false }
          );
        },
      });
  }
}
