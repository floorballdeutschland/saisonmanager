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
  GameOperationService,
  NotificationService,
  StateAssociationService,
} from '@floorball/core';
import { GameOperationAdmin, StateAssociation } from '@floorball/types';
import {
  IMAGE_UPLOAD_ACCEPT,
  isAllowedImageType,
} from 'src/app/_helpers/_utils/image-upload';

@Component({
  templateUrl: './game-operation-edit.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class GameOperationEditComponent implements OnInit, OnDestroy {
  gameOperation: Partial<GameOperationAdmin> = {
    name: '',
    short_name: '',
    path: '',
    national: false,
    state_association_id: null,
  };
  editMode = false;
  saving = false;
  deletingBanner = false;
  readonly acceptImageTypes = IMAGE_UPLOAD_ACCEPT;

  allStateAssociations: StateAssociation[] = [];
  // Landesverbände, an denen schon ein anderer Spielbetrieb hängt. Ein Verband
  // hat höchstens einen; die API lehnt einen zweiten ab. Sie hier aus der
  // Auswahl zu nehmen ist die freundlichere Hälfte derselben Regel.
  private _takenStateAssociationIds = new Set<number>();

  private _destroy$ = new Subject<void>();

  constructor(
    private _gameOperationService: GameOperationService,
    private _stateAssociationService: StateAssociationService,
    private _notificationService: NotificationService,
    private _route: ActivatedRoute,
    private _router: Router,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const id = this._route.snapshot.params['id'];
    const numericId = id ? parseInt(id, 10) : null;
    this.editMode = numericId !== null;

    this._stateAssociationService
      .adminGetAll()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (all) => {
          this.allStateAssociations = all;
          this._cdr.markForCheck();
        },
      });

    // Belegte Landesverbände aus der Spielbetriebsliste, nicht aus einem
    // eigenen Endpunkt. Der eigene Datensatz bleibt wählbar, sonst fiele beim
    // Bearbeiten der gespeicherte Verband aus der eigenen Auswahl.
    this._gameOperationService
      .getAdminGameOperations()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (gos) => {
          this._takenStateAssociationIds = new Set(
            gos
              .filter((go) => go.id !== numericId && !!go.state_association_id)
              .map((go) => go.state_association_id as number)
          );
          this._cdr.markForCheck();
        },
      });

    if (numericId !== null) {
      this._gameOperationService
        .adminGet(numericId)
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: (go) => {
            this.gameOperation = { ...go };
            this._cdr.markForCheck();
          },
        });
    }
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  // Auswählbare Landesverbände: alle bis auf die, an denen bereits ein anderer
  // Spielbetrieb hängt.
  get selectableStateAssociations(): StateAssociation[] {
    return this.allStateAssociations.filter(
      (sa) => !this._takenStateAssociationIds.has(sa.id)
    );
  }

  // Vorschau der öffentlichen Adresse. Ist noch kein Pfad eingetragen, leitet
  // die API ihn aus dem Kürzel ab – dieselbe Ableitung steht hier, damit die
  // Maske nicht erst nach dem Speichern zeigt, welche Adresse entsteht.
  get pathPreview(): string {
    const eingetragen = (this.gameOperation.path ?? '').trim().toLowerCase();
    if (eingetragen) return eingetragen;

    return (this.gameOperation.short_name ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // Zahl der Ligen, Vereine und Rollen am Spielbetrieb. Sie stehen in der
  // Maske, damit vor dem Löschen dasteht, was im Weg ist, statt es erst aus der
  // Fehlermeldung zu erfahren.
  get hasDependencies(): boolean {
    const d = this.gameOperation.dependencies;
    if (!d) return false;
    return d.leagues > 0 || d.clubs > 0 || d.users > 0;
  }

  submit(): void {
    if (!this.gameOperation.name?.trim()) return;
    if (!this.gameOperation.short_name?.trim()) return;

    this.saving = true;

    const payload: Partial<GameOperationAdmin> = {
      name: this.gameOperation.name,
      short_name: this.gameOperation.short_name,
      // Leer mitschicken ist Absicht: Dann leitet die API den Pfad aus dem
      // Kürzel ab und speichert ihn. Den abgeleiteten Wert hier einzusetzen
      // würde ihn als eigenen Eintrag festschreiben.
      path: this.gameOperation.path ?? '',
      national: this.gameOperation.national ?? false,
      state_association_id: this.gameOperation.state_association_id ?? null,
      banner_link_url: this.gameOperation.banner_link_url ?? null,
    };

    const call =
      this.editMode && this.gameOperation.id
        ? this._gameOperationService.adminUpdate(this.gameOperation.id, payload)
        : this._gameOperationService.adminCreate(payload);

    call.pipe(takeUntil(this._destroy$)).subscribe({
      next: () => {
        this._notificationService.success(
          this._transloco.translate(
            this.editMode
              ? 'gameOperationAdmin.notifications.saved'
              : 'gameOperationAdmin.notifications.created'
          ),
          { autoClose: true, keepAfterRouteChange: true }
        );
        this._router.navigate(['/', 'verwaltung', 'spielbetriebe']);
      },
      // Ohne eigene Meldung: Das übernimmt der ErrorInterceptor mit dem
      // Klartext aus `errors`. Ein zweiter Toast wäre eine Dublette, und weil
      // ein fehlgeschlagenes Speichern nicht navigiert, stapelten sie sich.
      error: () => {
        this.saving = false;
        this._cdr.markForCheck();
      },
    });
  }

  private readonly _maxBannerSize = 2 * 1024 * 1024;

  onBannerSelected(input: HTMLInputElement): void {
    if (!input.files?.length || !this.gameOperation.id) return;
    const file = input.files[0];

    if (!isAllowedImageType(file)) {
      this._notificationService.error(
        this._transloco.translate(
          'gameOperationAdmin.notifications.bannerTypeError'
        ),
        { autoClose: false }
      );
      input.value = '';
      return;
    }
    if (file.size > this._maxBannerSize) {
      this._notificationService.error(
        this._transloco.translate(
          'gameOperationAdmin.notifications.bannerSizeError'
        ),
        { autoClose: false }
      );
      input.value = '';
      return;
    }

    this._gameOperationService
      .adminUploadBanner(this.gameOperation.id, file)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          input.value = '';
          this.gameOperation.banner_url = result.banner_url;
          this._notificationService.success(
            this._transloco.translate(
              'gameOperationAdmin.notifications.bannerUploaded'
            ),
            { autoClose: true }
          );
          this._cdr.markForCheck();
        },
        error: (err) => {
          input.value = '';
          const msg: string =
            err?.error?.message ??
            this._transloco.translate(
              'gameOperationAdmin.notifications.bannerUploadError'
            );
          this._notificationService.error(msg, { autoClose: false });
        },
      });
  }

  deleteBanner(): void {
    if (!this.gameOperation.id || this.deletingBanner) return;
    if (
      !confirm(
        this._transloco.translate(
          'gameOperationAdmin.notifications.confirmDeleteBanner'
        )
      )
    )
      return;

    this.deletingBanner = true;
    this._gameOperationService
      .adminDeleteBanner(this.gameOperation.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.gameOperation.banner_url = null;
          this.deletingBanner = false;
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.deletingBanner = false;
          const msg: string =
            err?.error?.message ??
            this._transloco.translate(
              'gameOperationAdmin.notifications.bannerDeleteError'
            );
          this._notificationService.error(msg, { autoClose: false });
          this._cdr.markForCheck();
        },
      });
  }
}
