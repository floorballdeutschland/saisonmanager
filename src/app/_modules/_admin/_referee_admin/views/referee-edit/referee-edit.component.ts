import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NotificationService, RefereeService } from '@floorball/core';
import { RefereeAdmin } from '@floorball/types';

@Component({
  templateUrl: './referee-edit.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RefereeEditComponent implements OnInit {
  referee: Partial<RefereeAdmin> = {};
  editMode = false;
  loading = false;
  saving = false;

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

  constructor(
    private _refereeService: RefereeService,
    private _route: ActivatedRoute,
    private _router: Router,
    private _notificationService: NotificationService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const lizenznummer = this._route.snapshot.params['lizenznummer'];
    if (lizenznummer) {
      this.editMode = true;
      this.loading = true;
      this._refereeService.adminGetAll({ q: lizenznummer }).subscribe({
        next: (results) => {
          const match = results.find(
            (r) => r.lizenznummer === parseInt(lizenznummer, 10)
          );
          if (match) {
            this._refereeService.adminGetById(match.id).subscribe({
              next: (r) => {
                this.referee = { ...r };
                this.loading = false;
                this._cdr.markForCheck();
              },
            });
          } else {
            this.loading = false;
            this._cdr.markForCheck();
          }
        },
      });
    }
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

    const call =
      this.editMode && this.referee.id
        ? this._refereeService.adminUpdate(this.referee.id, this.referee)
        : this._refereeService.adminCreate(this.referee);

    call.subscribe({
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

    this._refereeService.adminDelete(this.referee.id).subscribe({
      next: () => {
        this._notificationService.success('Schiedsrichter gelöscht.', {
          autoClose: true,
          keepAfterRouteChange: true,
        });
        this._router.navigate(['/', 'verwaltung', 'schiedsrichter']);
      },
    });
  }
}
