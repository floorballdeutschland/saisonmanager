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
  AssociationService,
  NotificationService,
  RefereeService,
} from '@floorball/core';
import { RefereeAdmin, StateAssociation } from '@floorball/types';

@Component({
  templateUrl: './referee-edit.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RefereeEditComponent implements OnInit, OnDestroy {
  referee: Partial<RefereeAdmin> = {};
  editMode = false;
  loading = false;
  saving = false;
  stateAssociations: StateAssociation[] = [];

  readonly lizenzstufen = [
    'A',
    'B',
    'L1',
    'L2',
    'L3',
    'N1',
    'N2',
    'N3',
    'F',
    'sonstige',
  ];

  private _destroy$ = new Subject<void>();

  constructor(
    private _refereeService: RefereeService,
    private _associationService: AssociationService,
    private _route: ActivatedRoute,
    private _router: Router,
    private _notificationService: NotificationService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._associationService.stateAssociations$
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.stateAssociations = result;
          this._cdr.markForCheck();
        },
      });

    const lizenznummer = this._route.snapshot.params['lizenznummer'];
    if (lizenznummer) {
      this.editMode = true;
      this.loading = true;
      this._refereeService
        .adminGetAll({ q: lizenznummer })
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: (results) => {
            const match = results.find(
              (r) => r.lizenznummer === parseInt(lizenznummer, 10)
            );
            if (match) {
              this._refereeService
                .adminGetById(match.id)
                .pipe(takeUntil(this._destroy$))
                .subscribe({
                  next: (r) => {
                    this.referee = {
                      ...r,
                      gueltigkeit: this._toInputDate(r.gueltigkeit),
                      gueltigkeit_z: this._toInputDate(r.gueltigkeit_z),
                      geburtsdatum: this._toInputDate(r.geburtsdatum),
                    };
                    this.loading = false;
                    this._cdr.markForCheck();
                  },
                  error: () => {
                    this.loading = false;
                    this._cdr.markForCheck();
                    this._notificationService.error(
                      'Fehler beim Laden des Schiedsrichters.',
                      { autoClose: false, keepAfterRouteChange: false }
                    );
                  },
                });
            } else {
              this.loading = false;
              this._cdr.markForCheck();
            }
          },
          error: () => {
            this.loading = false;
            this._cdr.markForCheck();
            this._notificationService.error('Fehler beim Laden.', {
              autoClose: false,
              keepAfterRouteChange: false,
            });
          },
        });
    }
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  submit(): void {
    if (
      !this.referee.vorname ||
      !this.referee.nachname ||
      !this.referee.lizenznummer
    ) {
      return;
    }

    this.saving = true;

    // Convert YYYY-MM-DD (input) back to DD.MM.YYYY (API) for date fields
    const payload: Partial<RefereeAdmin> = {
      ...this.referee,
      gueltigkeit: this._fromInputDate(this.referee.gueltigkeit),
      gueltigkeit_z: this._fromInputDate(this.referee.gueltigkeit_z),
      geburtsdatum: this._fromInputDate(this.referee.geburtsdatum),
    };

    const call =
      this.editMode && this.referee.id
        ? this._refereeService.adminUpdate(this.referee.id, payload)
        : this._refereeService.adminCreate(payload);

    call.pipe(takeUntil(this._destroy$)).subscribe({
      next: (saved) => {
        this._notificationService.success(
          this.editMode
            ? 'Schiedsrichter gespeichert.'
            : 'Schiedsrichter angelegt.',
          { autoClose: true, keepAfterRouteChange: true }
        );
        this._router.navigate([
          '/',
          'verwaltung',
          'schiedsrichter',
          saved.lizenznummer,
        ]);
      },
      error: () => {
        this.saving = false;
        this._cdr.markForCheck();
        this._notificationService.error('Fehler beim Speichern.', {
          autoClose: false,
          keepAfterRouteChange: false,
        });
      },
    });
  }

  delete(): void {
    if (!this.referee.id) return;
    if (
      !confirm(
        `Schiedsrichter ${this.referee.vorname} ${this.referee.nachname} wirklich löschen?`
      )
    )
      return;

    this._refereeService
      .adminDelete(this.referee.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this._notificationService.success('Schiedsrichter gelöscht.', {
            autoClose: true,
            keepAfterRouteChange: true,
          });
          this._router.navigate(['/', 'verwaltung', 'schiedsrichter']);
        },
        error: () => {
          this._notificationService.error('Fehler beim Löschen.', {
            autoClose: false,
            keepAfterRouteChange: false,
          });
        },
      });
  }

  /** Convert DD.MM.YYYY (API) to YYYY-MM-DD (HTML date input) */
  private _toInputDate(value: string | undefined): string | undefined {
    if (!value) return undefined;
    const parts = value.split('.');
    if (parts.length !== 3) return value;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  /** Convert YYYY-MM-DD (HTML date input) to DD.MM.YYYY (API) */
  private _fromInputDate(value: string | undefined): string | undefined {
    if (!value) return undefined;
    const parts = value.split('-');
    if (parts.length !== 3) return value;
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
}
