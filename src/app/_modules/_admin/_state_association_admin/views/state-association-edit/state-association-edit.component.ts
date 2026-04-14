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
import { StateAssociationService, NotificationService } from '@floorball/core';
import { StateAssociation } from '@floorball/types';

@Component({
  templateUrl: './state-association-edit.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StateAssociationEditComponent implements OnInit, OnDestroy {
  stateAssociation: Partial<StateAssociation> = { name: '', short_name: '' };
  editMode = false;
  saving = false;

  private _destroy$ = new Subject<void>();

  constructor(
    private _stateAssociationService: StateAssociationService,
    private _notificationService: NotificationService,
    private _route: ActivatedRoute,
    private _router: Router,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const id = this._route.snapshot.params['id'];
    if (id) {
      this.editMode = true;
      this._stateAssociationService
        .adminGetAll()
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: (all) => {
            const found = all.find((sa) => sa.id === parseInt(id, 10));
            if (found) {
              this.stateAssociation = { ...found };
            }
            this._cdr.markForCheck();
          },
        });
    }
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  submit(): void {
    if (!this.stateAssociation.name?.trim()) return;

    this.saving = true;

    const call =
      this.editMode && this.stateAssociation.id
        ? this._stateAssociationService.adminUpdate(
            this.stateAssociation.id,
            this.stateAssociation
          )
        : this._stateAssociationService.adminCreate(this.stateAssociation);

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
}
